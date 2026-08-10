import type { TicketType } from "./types";

// Config-driven pricing. All amounts in integer cents. The per-person
// price slides with quantity via ticket_type.pricing_rules.per_person_tiers,
// so admin can retune tiers without a code change.

export type PriceBreakdown = {
  quantity: number; // total tickets chosen
  paidQuantity: number; // tickets actually charged for
  freeQuantity: number; // tickets given free (buy X get Y free)
  unitPriceCents: number; // per-person price at this quantity
  subtotalCents: number; // unit * paidQuantity
  savingsCents: number; // vs paying full price for every ticket
};

/** Per-person price for a given quantity: highest matching tier wins. */
export function unitPriceCentsForQty(tt: TicketType, qty: number): number {
  const tiers = [...(tt.pricing_rules?.per_person_tiers ?? [])].sort(
    (a, b) => a.min_qty - b.min_qty,
  );
  let price = tt.price_cents;
  for (const tier of tiers) {
    if (qty >= tier.min_qty) price = tier.price_cents;
  }
  return price;
}

/** Number of free tickets from a "buy X get Y free" rule at this quantity. */
export function freeQuantityForQty(tt: TicketType, qty: number): number {
  const rule = tt.pricing_rules?.buy_x_get_y;
  if (!rule || rule.buy <= 0 || rule.free <= 0) return 0;
  const groupSize = rule.buy + rule.free;
  return Math.floor(qty / groupSize) * rule.free;
}

export function priceBreakdown(tt: TicketType, qty: number): PriceBreakdown {
  const quantity = Math.max(0, Math.floor(qty));
  const unitPriceCents = unitPriceCentsForQty(tt, quantity);
  const freeQuantity = freeQuantityForQty(tt, quantity);
  const paidQuantity = quantity - freeQuantity;
  const subtotalCents = unitPriceCents * paidQuantity;
  const singlePrice = unitPriceCentsForQty(tt, 1);
  const savingsCents = Math.max(0, singlePrice * quantity - subtotalCents);
  return {
    quantity,
    paidQuantity,
    freeQuantity,
    unitPriceCents,
    subtotalCents,
    savingsCents,
  };
}

/** AUD formatting: whole dollars when even, else 2dp (e.g. $329, $239.20). */
export function formatAud(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
