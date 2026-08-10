// Domain types mirroring the Phase 1 Supabase schema (see
// supabase/migrations). Kept hand-written and minimal for now.

export type PerPersonTier = {
  min_qty: number;
  price_cents: number;
};

export type BuyXGetYFree = {
  buy: number; // pay for this many...
  free: number; // ...then this many are free (repeats every buy+free)
};

export type PricingRules = {
  // Per-person price by total quantity: the tier with the greatest
  // min_qty <= quantity wins. Empty/absent => flat price_cents.
  per_person_tiers?: PerPersonTier[];
  // "Buy 4, get 1 free": every (buy+free)-th group yields `free` free tickets.
  buy_x_get_y?: BuyXGetYFree;
};

export type TicketType = {
  id: string;
  event_id: string;
  key: string;
  name: string;
  description: string | null;
  price_cents: number; // "from" / single-person price
  currency: string;
  inc_gst: boolean;
  min_quantity: number;
  max_quantity: number | null;
  inclusions: string[];
  pricing_rules: PricingRules;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
};

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  currency: string;
};
