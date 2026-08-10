import type { TicketType } from "./types";

// Config-driven pricing. All amounts in integer cents. A ticket's price can
// vary by position in the order (price_bands), by total quantity
// (per_person_tiers), or by a buy-X-get-Y-free rule — resolved per position so
// mixed models (e.g. 5th free, then a cheaper rate) compute correctly.

export type PriceSegment = {
  count: number; // consecutive tickets at this price
  unitPriceCents: number; // 0 = free
};

export type PriceBreakdown = {
  quantity: number; // total tickets chosen
  paidQuantity: number; // tickets actually charged for
  freeQuantity: number; // tickets given free
  subtotalCents: number; // total charged
  savingsCents: number; // vs full price (position-1 price) for every ticket
  segments: PriceSegment[]; // grouped for display, in position order
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

/** Price of the ticket at 1-indexed position `pos` within an order of `qty`. */
function positionPriceCents(tt: TicketType, pos: number, qty: number): number {
  const rules = tt.pricing_rules ?? {};

  const bands = rules.price_bands;
  if (bands && bands.length > 0) {
    for (const band of bands) {
      const hi = band.to ?? Infinity;
      if (pos >= band.from && pos <= hi) return band.price_cents;
    }
    return tt.price_cents; // positions outside all bands fall back to base
  }

  const bxgy = rules.buy_x_get_y;
  if (bxgy && bxgy.buy > 0 && bxgy.free > 0) {
    const group = bxgy.buy + bxgy.free;
    const posInGroup = ((pos - 1) % group) + 1;
    return posInGroup > bxgy.buy ? 0 : unitPriceCentsForQty(tt, qty);
  }

  return unitPriceCentsForQty(tt, qty);
}

export function priceBreakdown(tt: TicketType, qtyRaw: number): PriceBreakdown {
  const quantity = Math.max(0, Math.floor(qtyRaw));

  const prices: number[] = [];
  for (let pos = 1; pos <= quantity; pos++) {
    prices.push(positionPriceCents(tt, pos, quantity));
  }

  const subtotalCents = prices.reduce((sum, p) => sum + p, 0);
  const freeQuantity = prices.filter((p) => p === 0).length;
  const paidQuantity = quantity - freeQuantity;
  const singlePrice = positionPriceCents(tt, 1, 1);
  const savingsCents = Math.max(0, singlePrice * quantity - subtotalCents);

  const segments: PriceSegment[] = [];
  for (const p of prices) {
    const last = segments[segments.length - 1];
    if (last && last.unitPriceCents === p) last.count += 1;
    else segments.push({ count: 1, unitPriceCents: p });
  }

  return {
    quantity,
    paidQuantity,
    freeQuantity,
    subtotalCents,
    savingsCents,
    segments,
  };
}

/** AUD formatting: whole dollars when even, else 2dp (e.g. $329, $249.50). */
export function formatAud(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
