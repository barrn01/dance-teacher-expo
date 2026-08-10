import type { TicketType } from "./types";

// Config-driven pricing. All amounts in integer cents. The per-person
// price slides with quantity via ticket_type.pricing_rules.per_person_tiers,
// so admin can retune tiers without a code change.

export type PriceBreakdown = {
  quantity: number;
  unitPriceCents: number; // per-person price at this quantity
  subtotalCents: number; // unit * quantity
  savingsCents: number; // vs paying the single-person price for every seat
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

export function priceBreakdown(tt: TicketType, qty: number): PriceBreakdown {
  const quantity = Math.max(0, Math.floor(qty));
  const unitPriceCents = unitPriceCentsForQty(tt, quantity);
  const subtotalCents = unitPriceCents * quantity;
  const singlePrice = unitPriceCentsForQty(tt, 1);
  const savingsCents = Math.max(0, singlePrice * quantity - subtotalCents);
  return { quantity, unitPriceCents, subtotalCents, savingsCents };
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
