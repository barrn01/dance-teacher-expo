import type { TicketType } from "./types";

// ---------------------------------------------------------------------------
// Black Friday sale — a flag-driven price overlay.
//
// The sale is toggled by a single env var so it can be previewed (set on the
// Vercel Preview environment) before it goes live (set on Production), and
// reverted by simply unsetting it — no code change, no database edit. Prices
// stay server-authoritative because the overlay runs inside the ONE ticket-type
// loader, getEventWithTicketTypes(), so the selector, the checkout total, the
// Stripe charge amount and fulfilment all compute from the same sale prices.
//
// Revert: remove NEXT_PUBLIC_BLACK_FRIDAY_SALE (or set it to anything but
// "true") in Vercel and redeploy. Everything returns to the DB config ($329 /
// 5th free / $249 from the 6th).
// ---------------------------------------------------------------------------

export const BLACK_FRIDAY_SALE =
  process.env.NEXT_PUBLIC_BLACK_FRIDAY_SALE === "true";

export const SALE_LABEL = "Black Friday Sale";

// Every paid ticket drops to this during the sale. The free 5th stays free.
export const SALE_UNIT_PRICE_CENTS = 22_900; // $229

// The pre-sale headline price, shown struck-through on marketing surfaces that
// don't load a ticket type (homepage band, tickets hero). Data-driven surfaces
// use the ticket's own price as the "compare at" instead (see applySale).
export const REGULAR_UNIT_PRICE_CENTS = 32_900; // $329

/**
 * If the Black Friday sale is on, rewrite a ticket type's prices to the sale
 * rate and attach sale metadata for display.
 *
 * - The base price and every PAID price band drop to SALE_UNIT_PRICE_CENTS.
 * - Free bands (the 5th ticket) are left untouched.
 * - A never-raise guard means tiers already below the sale price stay as-is.
 * - pricing_rules.sale records the original base price so display surfaces can
 *   strike it through consistently.
 *
 * No-op when the flag is off, so it's safe to call unconditionally.
 */
export function applySale(tt: TicketType): TicketType {
  if (!BLACK_FRIDAY_SALE) return tt;

  const compareAtCents = tt.price_cents;
  if (compareAtCents <= SALE_UNIT_PRICE_CENTS) return tt; // never raise a price

  const rules = tt.pricing_rules ?? {};

  const price_bands = rules.price_bands?.map((b) =>
    b.price_cents > 0 ? { ...b, price_cents: SALE_UNIT_PRICE_CENTS } : b,
  );
  const per_person_tiers = rules.per_person_tiers?.map((t) =>
    t.price_cents > 0
      ? { ...t, price_cents: Math.min(t.price_cents, SALE_UNIT_PRICE_CENTS) }
      : t,
  );

  return {
    ...tt,
    price_cents: SALE_UNIT_PRICE_CENTS,
    pricing_rules: {
      ...rules,
      ...(price_bands ? { price_bands } : {}),
      ...(per_person_tiers ? { per_person_tiers } : {}),
      sale: { label: SALE_LABEL, compare_at_cents: compareAtCents },
    },
  };
}
