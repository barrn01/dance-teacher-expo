"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail, getAdminGate } from "@/lib/admin";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { sendOrderConfirmation, type TicketForEmail } from "@/lib/email";
import { upsertContact } from "@/lib/ghl";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export type RefundResult = {
  ok: boolean;
  error?: string;
  refundedCents?: number;
  status?: string;
};

/**
 * Refund an order (full or partial) via Stripe, then update our order state.
 * Admin-gated. Idempotency-keyed on the current refunded total so a double
 * submit can't double-refund. A full refund also marks the tickets refunded.
 */
export async function refundOrder(input: {
  orderId: string;
  amountCents?: number; // omitted/0 = refund everything remaining
}): Promise<RefundResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const sb = createServiceClient();
  const { data: order } = await sb
    .from("orders")
    .select(
      "id, status, total_cents, amount_refunded_cents, stripe_payment_intent_id",
    )
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found." };
  if (!order.stripe_payment_intent_id)
    return { ok: false, error: "This order has no payment to refund." };
  if (order.status !== "paid" && order.status !== "partially_refunded")
    return { ok: false, error: `Can't refund a ${order.status} order.` };

  const refundable = order.total_cents - order.amount_refunded_cents;
  if (refundable <= 0) return { ok: false, error: "Nothing left to refund." };

  const amount =
    input.amountCents && input.amountCents > 0 ? input.amountCents : refundable;
  if (amount > refundable)
    return {
      ok: false,
      error: `Max refundable is $${(refundable / 100).toFixed(2)}.`,
    };

  try {
    await getStripe().refunds.create(
      { payment_intent: order.stripe_payment_intent_id, amount },
      {
        idempotencyKey: `refund_${order.id}_${order.amount_refunded_cents}_${amount}`,
      },
    );
  } catch (e) {
    console.error("[admin] Stripe refund failed", e);
    return { ok: false, error: "Stripe refused the refund — please try again." };
  }

  const newRefunded = order.amount_refunded_cents + amount;
  const fullyRefunded = newRefunded >= order.total_cents;
  const newStatus = fullyRefunded ? "refunded" : "partially_refunded";

  await sb
    .from("orders")
    .update({ status: newStatus, amount_refunded_cents: newRefunded })
    .eq("id", order.id);

  // On a full refund, void the tickets so they can't be used at the door.
  if (fullyRefunded) {
    await sb
      .from("tickets")
      .update({ status: "refunded" })
      .eq("order_id", order.id);
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin");
  return { ok: true, refundedCents: newRefunded, status: newStatus };
}

/**
 * Admin sign-in request. Unlike the buyer login (open to anyone), this checks
 * the admin allowlist BEFORE sending — a non-admin email gets a clear error and
 * no email at all. The magic link uses the token-hash flow (see /auth/confirm).
 */
export async function requestAdminLink(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim();
  if (!isEmail(e)) return { ok: false, error: "Please enter a valid email." };
  if (!isAdminEmail(e))
    return { ok: false, error: "This email doesn't have admin access." };

  const supabase = await createAuthServerClient();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dance-teacher-expo.vercel.app";
  const { error } = await supabase.auth.signInWithOtp({
    email: e,
    options: { emailRedirectTo: `${site}/auth/confirm?next=/admin` },
  });
  if (error) {
    console.error("[admin] signInWithOtp failed", error.message);
    return { ok: false, error: "Couldn't send the link — please try again." };
  }
  return { ok: true };
}

export type CompResult = {
  ok: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: string;
};

/**
 * Issue complimentary tickets (speakers, staff, prizes). Creates a paid $0
 * order flagged as a comp, one attendee + ticket per seat (recipient is the
 * first attendee, extras left unassigned to fill in later), optionally emails
 * the recipient their QR tickets, and syncs them to GHL as an attendee.
 */
export async function createComp(input: {
  name: string;
  email: string;
  phone?: string;
  ticketTypeKey?: string;
  quantity: number;
  reason: string;
  sendEmail: boolean;
}): Promise<CompResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Recipient name is required." };
  if (!isEmail(email))
    return { ok: false, error: "A valid recipient email is required." };
  const qty = Math.max(1, Math.min(50, Math.floor(input.quantity || 1)));

  const data = await getEventWithTicketTypes();
  if (!data) return { ok: false, error: "Event not found." };
  const tt =
    data.ticketTypes.find((t) => t.key === input.ticketTypeKey) ??
    data.ticketTypes[0];
  if (!tt) return { ok: false, error: "No ticket type configured." };

  const sb = createServiceClient();

  const { data: created, error: orderErr } = await sb
    .from("orders")
    .insert({
      event_id: data.event.id,
      status: "paid",
      buyer_name: name,
      buyer_email: email,
      buyer_phone: input.phone?.trim() || null,
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      currency: tt.currency,
      metadata: {
        comp: true,
        comp_reason: input.reason?.trim() || null,
        issued_by: gate.user.email,
      },
    })
    .select("id, order_number")
    .single();
  if (orderErr || !created)
    return { ok: false, error: "Could not create the comp order." };

  await sb.from("order_items").insert({
    order_id: created.id,
    ticket_type_id: tt.id,
    quantity: qty,
    unit_price_cents: 0,
    line_total_cents: 0,
  });

  const [first, ...rest] = name.split(/\s+/);
  const attRows = Array.from({ length: qty }, (_, i) =>
    i === 0
      ? {
          order_id: created.id,
          ticket_type_id: tt.id,
          first_name: first || null,
          last_name: rest.join(" ") || null,
          email,
          phone: input.phone?.trim() || null,
        }
      : {
          order_id: created.id,
          ticket_type_id: tt.id,
          first_name: null,
          last_name: null,
          email: null,
          phone: null,
        },
  );
  const { data: atts } = await sb
    .from("attendees")
    .insert(attRows)
    .select("id");

  const { data: tickets } = await sb
    .from("tickets")
    .insert(
      (atts ?? []).map((a) => ({
        order_id: created.id,
        attendee_id: a.id,
        ticket_type_id: tt.id,
        event_id: data.event.id,
      })),
    )
    .select("qr_token, attendee:attendees(first_name, last_name)");

  if (input.sendEmail) {
    const forEmail: TicketForEmail[] = (tickets ?? []).map((t, i) => {
      const a = one(
        t.attendee as
          | { first_name: string | null; last_name: string | null }
          | { first_name: string | null; last_name: string | null }[]
          | null,
      );
      const nm = [a?.first_name, a?.last_name].filter(Boolean).join(" ");
      return {
        attendeeName: nm || `Attendee ${i + 1}`,
        ticketTypeName: tt.name,
        qrToken: t.qr_token,
      };
    });
    await sendOrderConfirmation({
      to: email,
      buyerName: name,
      orderNumber: created.order_number,
      eventName: data.event.name,
      totalCents: 0,
      tickets: forEmail,
    });
  }

  await upsertContact({
    email,
    name,
    phone: input.phone?.trim() || null,
    tags: ["DTE2027-attendee", "DTE2027-comp"],
  });

  revalidatePath("/admin");
  return { ok: true, orderId: created.id, orderNumber: created.order_number };
}
