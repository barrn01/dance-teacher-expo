import "server-only";
import { createServiceClient } from "./supabase/server";
import { sendOrderConfirmation, type TicketForEmail } from "./email";

export type FulfillResult = {
  status: "ok" | "order_not_found" | "already_fulfilled";
  orderNumber?: string;
  ticketsIssued?: number;
  emailed?: boolean;
};

/**
 * Fulfil a paid order: mark it paid, issue one ticket per attendee, email the
 * buyer. Idempotent — safe to call for every webhook retry:
 *  - the pending→paid transition is guarded so only the first call "wins",
 *  - tickets upsert on attendees.attendee_id (unique) so none are duplicated,
 *  - the confirmation email is sent only by the call that won the transition.
 */
export async function fulfillOrderByPaymentIntent(
  paymentIntentId: string,
): Promise<FulfillResult> {
  const sb = createServiceClient();

  const { data: order } = await sb
    .from("orders")
    .select("id, order_number, status, event_id, buyer_email, buyer_name, total_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!order) return { status: "order_not_found" };

  // Claim the pending→paid transition; only one caller gets rows back.
  const { data: transitioned } = await sb
    .from("orders")
    .update({ status: "paid" })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  const justPaid = (transitioned?.length ?? 0) > 0;

  // Issue tickets (idempotent via unique attendee_id).
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

  // Fetch issued tickets with attendee + type names for the email.
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

  const { data: event } = await sb
    .from("events")
    .select("name")
    .eq("id", order.event_id)
    .maybeSingle();

  // PostgREST may type an embedded to-one relation as an array — normalise.
  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  type TicketRow = {
    qr_token: string;
    attendee: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
    ticket_type: { name: string } | { name: string }[] | null;
  };

  const forEmail: TicketForEmail[] = ((tickets ?? []) as TicketRow[]).map(
    (t, i) => {
      const a = one(t.attendee);
      const tt = one(t.ticket_type);
      const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ");
      return {
        // Deferred orders have no attendee names yet — number them so the
        // buyer can tell the QR tickets apart.
        attendeeName: name || `Attendee ${i + 1}`,
        ticketTypeName: tt?.name ?? "Ticket",
        qrToken: t.qr_token,
      };
    },
  );

  const emailResult = await sendOrderConfirmation({
    to: order.buyer_email,
    buyerName: order.buyer_name,
    orderNumber: order.order_number,
    eventName: event?.name ?? "Dance Teacher Expo 2027",
    totalCents: order.total_cents,
    tickets: forEmail,
  });

  return {
    status: "ok",
    orderNumber: order.order_number,
    ticketsIssued: ticketCount,
    emailed: emailResult.sent,
  };
}
