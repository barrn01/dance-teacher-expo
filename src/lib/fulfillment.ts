import "server-only";
import { createServiceClient } from "./supabase/server";
import { sendOrderConfirmation, type TicketForEmail } from "./email";
import { generateTaxInvoicePdf } from "./receipt";
import { sendMetaEvent } from "./meta";
import { upsertContact } from "./ghl";

export type FulfillResult = {
  status: "ok" | "order_not_found" | "already_fulfilled";
  orderNumber?: string;
  ticketsIssued?: number;
  emailed?: boolean;
  metaTracked?: boolean;
  ghlSynced?: boolean;
};

type OrderForFulfil = {
  id: string;
  order_number: string;
  status: string;
  event_id: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  total_cents: number;
  created_at: string;
  metadata: unknown;
  promo_code_id: string | null;
};

const ORDER_COLS =
  "id, order_number, status, event_id, buyer_email, buyer_name, buyer_phone, total_cents, created_at, metadata, promo_code_id";

/**
 * Fulfil a paid order from its Stripe PaymentIntent (webhook path). Idempotent.
 */
export async function fulfillOrderByPaymentIntent(
  paymentIntentId: string,
): Promise<FulfillResult> {
  const sb = createServiceClient();
  const { data: order } = await sb
    .from("orders")
    .select(ORDER_COLS)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle<OrderForFulfil>();
  if (!order) return { status: "order_not_found" };
  return fulfillFetchedOrder(order, {});
}

/**
 * Fulfil a $0 order (e.g. a 100%-off promo) that never goes through Stripe.
 * Same pipeline as the webhook path, minus the Meta Purchase (no revenue).
 */
export async function fulfillFreeOrder(orderId: string): Promise<FulfillResult> {
  const sb = createServiceClient();
  const { data: order } = await sb
    .from("orders")
    .select(ORDER_COLS)
    .eq("id", orderId)
    .maybeSingle<OrderForFulfil>();
  if (!order) return { status: "order_not_found" };
  return fulfillFetchedOrder(order, { skipMeta: true });
}

// PostgREST may type an embedded to-one relation as an array — normalise.
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/**
 * Core fulfilment: guarded pending→paid transition, issue one ticket per
 * attendee, send confirmation, count a promo redemption, sync Meta + GHL.
 * Idempotent — only the caller that wins the transition emails / tags / counts.
 */
async function fulfillFetchedOrder(
  order: OrderForFulfil,
  opts: { skipMeta?: boolean },
): Promise<FulfillResult> {
  const sb = createServiceClient();

  const { data: transitioned } = await sb
    .from("orders")
    .update({ status: "paid" })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  const justPaid = (transitioned?.length ?? 0) > 0;

  const { data: attendees } = await sb
    .from("attendees")
    .select("id, ticket_type_id")
    .eq("order_id", order.id);

  if (attendees && attendees.length > 0) {
    const ticketRows = attendees.map((a) => ({
      order_id: order.id,
      attendee_id: a.id,
      ticket_type_id: a.ticket_type_id,
      event_id: order.event_id,
    }));
    const { error: ticketErr } = await sb
      .from("tickets")
      .upsert(ticketRows, { onConflict: "attendee_id", ignoreDuplicates: true });
    if (ticketErr) throw ticketErr;
  }

  const { data: tickets } = await sb
    .from("tickets")
    .select(
      "qr_token, attendee:attendees(first_name, last_name), ticket_type:ticket_types(name)",
    )
    .eq("order_id", order.id);
  const ticketCount = tickets?.length ?? 0;

  if (!justPaid) {
    return {
      status: "already_fulfilled",
      orderNumber: order.order_number,
      ticketsIssued: ticketCount,
      emailed: false,
    };
  }

  // Count the promo redemption exactly once (on the winning transition).
  if (order.promo_code_id) {
    const { data: p } = await sb
      .from("promo_codes")
      .select("times_redeemed")
      .eq("id", order.promo_code_id)
      .maybeSingle();
    if (p)
      await sb
        .from("promo_codes")
        .update({ times_redeemed: p.times_redeemed + 1 })
        .eq("id", order.promo_code_id);
  }

  const { data: event } = await sb
    .from("events")
    .select("name")
    .eq("id", order.event_id)
    .maybeSingle();

  type TicketRow = {
    qr_token: string;
    attendee:
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null;
    ticket_type: { name: string } | { name: string }[] | null;
  };

  const forEmail: TicketForEmail[] = ((tickets ?? []) as TicketRow[]).map(
    (t, i) => {
      const a = one(t.attendee);
      const tt = one(t.ticket_type);
      const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ");
      return {
        attendeeName: name || `Attendee ${i + 1}`,
        ticketTypeName: tt?.name ?? "Ticket",
        qrToken: t.qr_token,
      };
    },
  );

  const { data: items } = await sb
    .from("order_items")
    .select("quantity, line_total_cents, ticket_type:ticket_types(key, name)")
    .eq("order_id", order.id);

  type ItemRow = {
    quantity: number;
    line_total_cents: number;
    ticket_type: { key: string; name: string } | { key: string; name: string }[] | null;
  };

  const receiptLines = ((items ?? []) as ItemRow[]).map((it) => {
    const tt = one(it.ticket_type);
    return {
      description: `${tt?.name ?? "Ticket"} × ${it.quantity}`,
      amountCents: it.line_total_cents,
    };
  });

  const ticketTypeKeys = Array.from(
    new Set(
      ((items ?? []) as ItemRow[])
        .map((it) => one(it.ticket_type)?.key)
        .filter((k): k is string => !!k),
    ),
  );

  // Only a paid (non-zero) order gets a GST tax invoice.
  let receiptPdf: { filename: string; content: Buffer } | undefined;
  if (order.total_cents > 0) {
    try {
      const content = await generateTaxInvoicePdf({
        orderNumber: order.order_number,
        dateISO: order.created_at,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        lines: receiptLines,
        totalCents: order.total_cents,
      });
      receiptPdf = {
        filename: `tax-invoice-${order.order_number}.pdf`,
        content,
      };
    } catch (e) {
      console.error("[fulfillment] receipt PDF generation failed", e);
    }
  }

  const emailResult = await sendOrderConfirmation({
    to: order.buyer_email,
    buyerName: order.buyer_name,
    orderNumber: order.order_number,
    eventName: event?.name ?? "Dance Teacher Expo 2027",
    totalCents: order.total_cents,
    tickets: forEmail,
    receiptPdf,
  });

  // --- Tracking + marketing sync (best-effort; never block fulfilment) ---
  const attribution =
    (order.metadata as { attribution?: Record<string, string> } | null)
      ?.attribution ?? {};

  const metaResult = opts.skipMeta
    ? { sent: false }
    : await sendMetaEvent({
        eventName: "Purchase",
        eventId: order.order_number,
        eventSourceUrl: attribution.url ?? null,
        user: {
          email: order.buyer_email,
          phone: order.buyer_phone,
          fbp: attribution.fbp ?? null,
          fbc: attribution.fbc ?? null,
          clientIp: attribution.ip ?? null,
          userAgent: attribution.ua ?? null,
        },
        customData: {
          currency: "AUD",
          value: order.total_cents / 100,
          numItems: ticketCount,
          contentType: "product",
          contentIds: ticketTypeKeys,
        },
      });

  const { data: attDetails } = await sb
    .from("attendees")
    .select("first_name, last_name, email, phone")
    .eq("order_id", order.id);
  const attendeeRows = attDetails ?? [];

  const detailsDeferred =
    (order.metadata as { details_deferred?: boolean } | null)
      ?.details_deferred === true;
  const detailsPending =
    detailsDeferred || attendeeRows.some((a) => !a.email);

  const buyerTags = ["DTE2027-purchaser", "DTE2027-attendee"];
  if (detailsPending) buyerTags.push("DTE2027-attendees-outstanding");
  const ghlResult = await upsertContact({
    email: order.buyer_email,
    name: order.buyer_name,
    phone: order.buyer_phone,
    tags: buyerTags,
  });

  const buyerEmailLc = order.buyer_email.toLowerCase();
  for (const a of attendeeRows) {
    if (!a.email || a.email.toLowerCase() === buyerEmailLc) continue;
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || null;
    await upsertContact({
      email: a.email,
      name,
      phone: a.phone,
      tags: ["DTE2027-attendee"],
    });
  }

  return {
    status: "ok",
    orderNumber: order.order_number,
    ticketsIssued: ticketCount,
    emailed: emailResult.sent,
    metaTracked: metaResult.sent,
    ghlSynced: ghlResult.synced,
  };
}
