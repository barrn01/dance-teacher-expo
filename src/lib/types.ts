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

// Marginal, position-based pricing: ticket at 1-indexed position `pos` costs
// the first band where from <= pos <= (to ?? ∞). e.g. Buy-4-get-5th-free then
// $249 from the 6th:
//   [{from:1,to:4,price_cents:32900},{from:5,to:5,price_cents:0},{from:6,price_cents:24900}]
export type PriceBand = {
  from: number; // 1-indexed position, inclusive
  to?: number; // inclusive upper bound; omit for open-ended
  price_cents: number; // 0 = free
};

export type PricingRules = {
  // Marginal price bands by ticket position (richest option; wins if present).
  price_bands?: PriceBand[];
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

export type Vendor = {
  id: string;
  event_id: string;
  company_name: string;
  slug: string;
  package_family: "service" | "fashion" | null;
  package_tier: "platinum" | "gold" | "silver" | "bronze" | null;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  booth_number: string | null;
  status: "active" | "inactive";
  logo_url: string | null; // legacy single logo; kept in sync with logos.square/primary
  logos: Record<string, string>; // slot -> public url (square, primary, horizontal, mono)
  description: string | null;
  website_url: string | null;
  instagram: string | null;
  facebook: string | null;
  public_contact_email: string | null;
  profile_completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type VendorDocument = {
  id: string;
  vendor_id: string;
  doc_type: "insurance" | "contract" | "safety" | "other";
  label: string | null;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  status: "submitted" | "approved" | "rejected";
  uploaded_by: string | null;
  created_at: string;
};

export type Speaker = {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  title: string | null;
  company: string | null;
  tagline: string | null;
  pronouns: string | null;
  bio: string | null;
  headshot_url: string | null;
  website_url: string | null;
  instagram: string | null;
  vendor_id: string | null;
  is_featured: boolean;
  is_homepage_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Room = {
  id: string;
  event_id: string;
  name: string;
  level: string | null;
  capacity: number | null;
  sort_order: number;
};

export type SessionRow = {
  id: string;
  event_id: string;
  title: string;
  slug: string | null;
  description: string | null;
  session_type: "keynote" | "workshop" | "panel" | "social" | "break" | "other";
  stream: "business" | "movement" | null;
  room_id: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_featured: boolean;
  is_published: boolean;
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
