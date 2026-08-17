"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail, getAdminGate } from "@/lib/admin";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

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
