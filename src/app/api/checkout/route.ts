import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { computeOrder, parseItemsParam, type Selection } from "@/lib/order";
import { validatePromo } from "@/lib/promo";
import { fulfillFreeOrder } from "@/lib/fulfillment";

export const runtime = "nodejs";

/** Parse a single cookie value out of a Cookie header. */
function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

type AttendeeInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type Body = {
  items?: string | Selection;
  buyer?: { name?: string; email?: string; phone?: string };
  attendees?: AttendeeInput[];
  // When true, the buyer is deferring attendee details — capture the order and
  // quantity now; each attendee's name/email is collected later (before expo).
  detailsDeferred?: boolean;
  promoCode?: string;
};

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const buyer = body.buyer ?? {};
  if (!isEmail(buyer.email)) {
    return NextResponse.json(
      { error: "A valid buyer email is required." },
      { status: 400 },
    );
  }
  if (!buyer.phone || buyer.phone.replace(/\D/g, "").length < 8) {
    return NextResponse.json(
      { error: "A valid buyer phone number is required." },
      { status: 400 },
    );
  }

  const selection: Selection =
    typeof body.items === "string" ? parseItemsParam(body.items) : (body.items ?? {});

  const data = await getEventWithTicketTypes();
  if (!data) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const order = computeOrder(data.ticketTypes, selection);
  if (order.totalQuantity <= 0 || order.totalCents <= 0) {
    return NextResponse.json({ error: "Your selection is empty." }, { status: 400 });
  }

  // Re-validate any promo code server-side (never trust the client's discount).
  let discountCents = 0;
  let promoCodeId: string | null = null;
  if (body.promoCode && body.promoCode.trim()) {
    const promo = await validatePromo(body.promoCode, order, data.event.id);
    if (!promo.ok) {
      return NextResponse.json({ error: promo.error }, { status: 400 });
    }
    discountCents = promo.discountCents;
    promoCodeId = promo.promo.id;
  }
  const finalTotal = Math.max(0, order.subtotalCents - discountCents);

  // One attendee per ticket. Distribute the flat attendee list across lines in
  // order; fall back to the buyer's details for any missing attendee.
  const attendeesInput = Array.isArray(body.attendees) ? body.attendees : [];
  if (attendeesInput.length > order.totalQuantity) {
    return NextResponse.json({ error: "Too many attendees." }, { status: 400 });
  }

  const sb = createServiceClient();

  // Meta attribution captured from the buyer's browser now, so the Stripe
  // webhook (server-to-server, no cookies) can replay a matching Purchase.
  const cookieHeader = request.headers.get("cookie");
  const attribution = {
    fbp: readCookie(cookieHeader, "_fbp"),
    fbc: readCookie(cookieHeader, "_fbc"),
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    ua: request.headers.get("user-agent"),
    url: request.headers.get("referer"),
  };

  // 1) Create the pending order.
  const { data: created, error: orderErr } = await sb
    .from("orders")
    .insert({
      event_id: data.event.id,
      status: "pending",
      buyer_name: buyer.name ?? null,
      buyer_email: buyer.email,
      buyer_phone: buyer.phone ?? null,
      subtotal_cents: order.subtotalCents,
      discount_cents: discountCents,
      total_cents: finalTotal,
      currency: order.currency,
      promo_code_id: promoCodeId,
      metadata: {
        details_deferred: body.detailsDeferred === true,
        attribution,
      },
    })
    .select("id, order_number")
    .single();

  if (orderErr || !created) {
    console.error("[checkout] order insert failed", orderErr);
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }

  // 2) Order items (one row per ticket type line).
  const orderItems = order.lines.map((l) => ({
    order_id: created.id,
    ticket_type_id: l.ticketType.id,
    quantity: l.breakdown.quantity,
    unit_price_cents: l.ticketType.price_cents,
    line_total_cents: l.breakdown.subtotalCents,
  }));
  const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
  if (itemsErr) {
    console.error("[checkout] order_items insert failed", itemsErr);
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }

  // 3) Attendees — one per ticket, mapped to their ticket type by line order.
  const attendeeRows: {
    order_id: string;
    ticket_type_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  }[] = [];
  let idx = 0;
  for (const line of order.lines) {
    for (let i = 0; i < line.breakdown.quantity; i++) {
      const a = attendeesInput[idx] ?? {};
      // Details are optional here — left null are completed later. Emails are
      // never defaulted to the buyer (each attendee needs their own).
      attendeeRows.push({
        order_id: created.id,
        ticket_type_id: line.ticketType.id,
        first_name: a.firstName?.trim() || null,
        last_name: a.lastName?.trim() || null,
        email: isEmail(a.email) ? a.email : null,
        phone: a.phone?.trim() || null,
      });
      idx++;
    }
  }

  // Single-ticket orders: the buyer IS the attendee — there's no separate
  // "attendee 1" to collect, so seed that lone row from the buyer's details.
  // (Multi-ticket orders never default an attendee to the buyer: each needs
  // their own email for the event app.)
  if (attendeeRows.length === 1 && !attendeeRows[0].email) {
    const [first, ...rest] = (buyer.name ?? "").trim().split(/\s+/);
    attendeeRows[0].first_name = first || null;
    attendeeRows[0].last_name = rest.join(" ") || null;
    attendeeRows[0].email = buyer.email;
    attendeeRows[0].phone = buyer.phone ?? null;
  }

  const { error: attErr } = await sb.from("attendees").insert(attendeeRows);
  if (attErr) {
    console.error("[checkout] attendees insert failed", attErr);
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }

  // 4a) Free order (100%-off promo): no Stripe — fulfil inline and return.
  if (finalTotal === 0) {
    await fulfillFreeOrder(created.id);
    return NextResponse.json({
      free: true,
      orderId: created.id,
      orderNumber: created.order_number,
      amountCents: 0,
      currency: order.currency,
    });
  }

  // 4b) PaymentIntent — amount is the server-computed (discounted) total.
  let clientSecret: string | null = null;
  try {
    const pi = await getStripe().paymentIntents.create(
      {
        amount: finalTotal,
        currency: order.currency.toLowerCase(),
        receipt_email: buyer.email,
        automatic_payment_methods: { enabled: true },
        metadata: {
          order_id: created.id,
          order_number: created.order_number,
          event_id: data.event.id,
        },
      },
      { idempotencyKey: `order_${created.id}` },
    );
    clientSecret = pi.client_secret;

    await sb
      .from("orders")
      .update({ stripe_payment_intent_id: pi.id })
      .eq("id", created.id);
  } catch (e) {
    console.error("[checkout] PaymentIntent create failed", e);
    return NextResponse.json(
      { error: "Could not start payment." },
      { status: 502 },
    );
  }

  // InitiateCheckout is fired earlier (from /api/track/initiate-checkout, once
  // the buyer completes name/email/phone). AddPaymentInfo fires from the
  // browser when they start entering card details. Purchase fires on payment.
  return NextResponse.json({
    clientSecret,
    orderId: created.id,
    orderNumber: created.order_number,
    amountCents: finalTotal,
    currency: order.currency,
  });
}
