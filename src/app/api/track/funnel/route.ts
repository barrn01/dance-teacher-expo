import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { computeOrder, parseItemsParam } from "@/lib/order";
import { sendMetaEvent } from "@/lib/meta";

export const runtime = "nodejs";

/**
 * Server-side funnel events fired from a client moment:
 *  - InitiateCheckout — when the buyer completes name/email/phone
 *  - AddPaymentInfo    — when they first interact with the card fields
 *
 * Sent server-side so we can hash the buyer's (just-entered) email/phone for
 * strong match quality and read fbp/fbc/ip/ua here, and so the events survive
 * browser tracking-protection. Each is server-only with a fresh event_id — no
 * browser counterpart, so no dedup. Best-effort: always returns ok, never
 * blocks the UI. (Purchase is handled separately, deduped, from the webhook.)
 */

const ALLOWED = new Set(["InitiateCheckout", "AddPaymentInfo"] as const);
type FunnelEvent = "InitiateCheckout" | "AddPaymentInfo";

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

type Body = {
  event?: string;
  items?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.event || !ALLOWED.has(body.event as FunnelEvent)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const eventName = body.event as FunnelEvent;

  const selection = parseItemsParam(body.items ?? "");
  const data = await getEventWithTicketTypes();
  if (!data) return NextResponse.json({ ok: false });
  const order = computeOrder(data.ticketTypes, selection);
  if (order.totalQuantity <= 0) return NextResponse.json({ ok: false });

  const cookieHeader = request.headers.get("cookie");
  await sendMetaEvent({
    eventName,
    eventId: randomUUID(),
    eventSourceUrl: request.headers.get("referer"),
    user: {
      // Hash whatever the buyer has entered so far (may be partial for an early
      // AddPaymentInfo); fbp/fbc/ip/ua still give a usable match either way.
      email: isEmail(body.email) ? body.email : null,
      phone: body.phone ?? null,
      fbp: readCookie(cookieHeader, "_fbp"),
      fbc: readCookie(cookieHeader, "_fbc"),
      clientIp:
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    },
    customData: {
      currency: order.currency,
      value: order.totalCents / 100,
      numItems: order.totalQuantity,
      contentType: "product",
      contentIds: order.lines.map((l) => l.ticketType.key),
    },
  });

  return NextResponse.json({ ok: true });
}
