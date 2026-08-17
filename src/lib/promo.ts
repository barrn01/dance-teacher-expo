import "server-only";
import { createServiceClient } from "./supabase/server";
import type { ComputedOrder } from "./order";

export type PromoRow = {
  id: string;
  code: string;
  event_id: string | null;
  discount_type: "percent" | "fixed_amount";
  discount_value: number;
  max_redemptions: number | null;
  times_redeemed: number;
  applies_to_ticket_type_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

const PROMO_COLS =
  "id, code, event_id, discount_type, discount_value, max_redemptions, times_redeemed, applies_to_ticket_type_ids, starts_at, ends_at, is_active";

export type PromoResult =
  | { ok: true; promo: PromoRow; discountCents: number; code: string }
  | { ok: false; error: string };

/**
 * Validate a promo code against a computed order and return the discount in
 * cents. Server-authoritative — the checkout API re-runs this, never trusting
 * a client-supplied discount. `code` is matched case-insensitively (citext).
 */
export async function validatePromo(
  codeRaw: string,
  order: ComputedOrder,
  eventId: string,
): Promise<PromoResult> {
  const code = codeRaw.trim();
  if (!code) return { ok: false, error: "Enter a promo code." };

  const sb = createServiceClient();
  const { data: promo } = await sb
    .from("promo_codes")
    .select(PROMO_COLS)
    .eq("code", code)
    .maybeSingle<PromoRow>();

  if (!promo) return { ok: false, error: "That code isn't valid." };
  if (!promo.is_active)
    return { ok: false, error: "That code is no longer active." };
  if (promo.event_id && promo.event_id !== eventId)
    return { ok: false, error: "That code doesn't apply to this event." };

  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now)
    return { ok: false, error: "That code isn't active yet." };
  if (promo.ends_at && new Date(promo.ends_at) < now)
    return { ok: false, error: "That code has expired." };
  if (
    promo.max_redemptions != null &&
    promo.times_redeemed >= promo.max_redemptions
  )
    return { ok: false, error: "That code has been fully redeemed." };

  // Eligible subtotal — restrict to applies_to_ticket_type_ids when set.
  const applies = promo.applies_to_ticket_type_ids;
  const scoped = !!applies && applies.length > 0;
  const eligibleSubtotal = order.lines.reduce((sum, l) => {
    if (!scoped || applies!.includes(l.ticketType.id))
      return sum + l.breakdown.subtotalCents;
    return sum;
  }, 0);
  if (eligibleSubtotal <= 0)
    return { ok: false, error: "That code doesn't apply to your selection." };

  let discountCents =
    promo.discount_type === "percent"
      ? Math.round((eligibleSubtotal * promo.discount_value) / 100)
      : Math.min(promo.discount_value, eligibleSubtotal);
  discountCents = Math.min(discountCents, order.subtotalCents);

  if (discountCents <= 0)
    return { ok: false, error: "That code gives no discount here." };

  return { ok: true, promo, discountCents, code: promo.code };
}

/** Human-readable summary of a code's offer, e.g. "20% off" / "$50 off". */
export function promoLabel(p: {
  discount_type: string;
  discount_value: number;
}): string {
  return p.discount_type === "percent"
    ? `${p.discount_value}% off`
    : `$${(p.discount_value / 100).toFixed(2)} off`;
}
