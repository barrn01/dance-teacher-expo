import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { computeOrder, parseItemsParam } from "@/lib/order";
import { sendMetaEvent } from "@/lib/meta";

export const runtime = "nodejs";

/**
 * Fires the server-side InitiateCheckout the moment the buyer has entered the
 * three required fields (name, email, phone) — i.e. they're a committed lead,
 * but well before they touch the card. Server-side so we can hash the just-
 * entered email/phone for strong match quality and read fbp/fbc/ip/ua here.
 *
 * Server-only event with a fresh event_id (no browser counterpart), so no
 * dedup is needed. Best-effort: always returns ok, never blocks the UI.
 */

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

  if (!isEmail(body.email) || !body.phone) {
    return NextResponse.json({ ok: false });
  }

  const selection = parseItemsParam(body.items ?? "");
  const data = await getEventWithTicketTypes();
  if (!data) return NextResponse.json({ ok: false });
  const order = computeOrder(data.ticketTypes, selection);
  if (order.totalQuantity <= 0) return NextResponse.json({ ok: false });

  const cookieHeader = request.headers.get("cookie");
  await sendMetaEvent({
    eventName: "InitiateCheckout",
    eventId: randomUUID(),
    eventSourceUrl: request.headers.get("referer"),
    user: {
      email: body.email,
      phone: body.phone,
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
