-- ============================================================
-- Dance Teacher Expo 2027 — Phase 1 (ticketing) schema
-- Tables: events, ticket_types, promo_codes, orders,
--         order_items, attendees, tickets
--
-- Conventions (see CLAUDE.md):
--   * Money is stored in integer cents. Currency default AUD.
--   * Timestamps are timestamptz (UTC); display in Australia/Sydney.
--   * RLS is enabled on every table from the first migration.
--   * The Stripe webhook (service_role) is the source of truth for
--     order/ticket state. service_role bypasses RLS. Public/anon may
--     only read published events and their active ticket types.
-- ============================================================

create extension if not exists pgcrypto;  -- gen_random_uuid(), gen_random_bytes()
create extension if not exists citext;     -- case-insensitive emails / codes

-- ---------- shared updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- events
-- ============================================================
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  status        text not null default 'draft'
                  check (status in ('draft', 'published', 'archived')),
  start_at      timestamptz,
  end_at        timestamptz,
  timezone      text not null default 'Australia/Sydney',
  venue_name    text,
  venue_address text,
  currency      text not null default 'AUD',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ============================================================
-- ticket_types  (pricing tiers and rules as editable config)
-- ============================================================
create table public.ticket_types (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  key           text not null,               -- stable code, e.g. 'two_day_all_access'
  name          text not null,
  description   text,
  price_cents   integer not null check (price_cents >= 0), -- base per-person price
  currency      text not null default 'AUD',
  inc_gst       boolean not null default true, -- attendee prices are GST-inclusive
  min_quantity  integer not null default 1 check (min_quantity >= 1),
  max_quantity  integer check (max_quantity is null or max_quantity >= min_quantity),
  -- what's included, rendered on the ticket card, e.g. ["Two full days", "Fashion Show"]
  inclusions    jsonb not null default '[]'::jsonb,
  -- config-driven group / sliding-scale rules so admin can edit without code, e.g.
  -- {"per_person_tiers":[{"min_qty":2,"price_cents":29900},{"min_qty":5,"price_cents":23900}],
  --  "buy_x_get_y":{"buy":4,"free":1}}
  pricing_rules jsonb not null default '{}'::jsonb,
  capacity      integer check (capacity is null or capacity >= 0), -- null = unlimited
  is_featured   boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (event_id, key)
);

create index ticket_types_event_idx on public.ticket_types (event_id);

create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row execute function public.set_updated_at();

-- ============================================================
-- promo_codes
-- ============================================================
create table public.promo_codes (
  id                        uuid primary key default gen_random_uuid(),
  event_id                  uuid references public.events(id) on delete cascade, -- null = all events
  code                      citext not null unique,
  discount_type             text not null check (discount_type in ('percent', 'fixed_amount')),
  discount_value            integer not null check (discount_value >= 0), -- percent 0-100, or cents
  max_redemptions           integer check (max_redemptions is null or max_redemptions >= 0),
  times_redeemed            integer not null default 0 check (times_redeemed >= 0),
  applies_to_ticket_type_ids uuid[],           -- null/empty = applies to all
  starts_at                 timestamptz,
  ends_at                   timestamptz,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create trigger promo_codes_set_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

-- ============================================================
-- orders
-- ============================================================
create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  event_id                  uuid not null references public.events(id),
  order_number              text not null unique
                              default 'DTE-' || upper(encode(gen_random_bytes(4), 'hex')),
  status                    text not null default 'pending'
                              check (status in ('pending', 'paid', 'refunded',
                                                'partially_refunded', 'cancelled')),
  buyer_name                text,
  buyer_email               citext not null,
  buyer_phone               text,
  subtotal_cents            integer not null default 0 check (subtotal_cents >= 0),
  discount_cents            integer not null default 0 check (discount_cents >= 0),
  total_cents               integer not null default 0 check (total_cents >= 0),
  amount_refunded_cents     integer not null default 0 check (amount_refunded_cents >= 0),
  currency                  text not null default 'AUD',
  promo_code_id             uuid references public.promo_codes(id),
  -- Stripe: payment_intent id is the idempotency anchor for the webhook.
  stripe_payment_intent_id  text unique,
  stripe_checkout_session_id text,
  metadata                  jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index orders_event_idx  on public.orders (event_id);
create index orders_email_idx  on public.orders (buyer_email);
create index orders_status_idx on public.orders (status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ============================================================
-- order_items  (one row per ticket_type line on an order)
-- ============================================================
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  ticket_type_id   uuid not null references public.ticket_types(id),
  quantity         integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0), -- captured at purchase
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at       timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

-- ============================================================
-- attendees  (buyer supplies name/email for each attendee)
-- ============================================================
create table public.attendees (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  first_name     text,
  last_name      text,
  email          citext,
  phone          text,
  custom_fields  jsonb not null default '{}'::jsonb, -- dietary, studio name, etc. (minimise PII)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index attendees_order_idx on public.attendees (order_id);

create trigger attendees_set_updated_at
  before update on public.attendees
  for each row execute function public.set_updated_at();

-- ============================================================
-- tickets  (exactly one per attendee, unique opaque QR token)
-- ============================================================
create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  attendee_id    uuid not null unique references public.attendees(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  event_id       uuid not null references public.events(id),
  -- Opaque, unguessable token encoded into the QR code.
  qr_token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  status         text not null default 'issued'
                   check (status in ('issued', 'checked_in', 'void', 'refunded')),
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index tickets_order_idx on public.tickets (order_id);
create index tickets_event_idx on public.tickets (event_id);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
--   Enable on every table. service_role bypasses RLS and drives all
--   writes (Stripe webhook). Public/anon may only read published
--   events and their active ticket types, to render the ticket pages.
--   Admin read/write policies arrive with the admin auth work (Phase 1
--   step 6) via an is_admin() helper — deliberately no such policy yet.
-- ============================================================
alter table public.events       enable row level security;
alter table public.ticket_types enable row level security;
alter table public.promo_codes  enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.attendees    enable row level security;
alter table public.tickets      enable row level security;

-- Public read: published events only.
create policy "events: public read published"
  on public.events for select
  to anon, authenticated
  using (status = 'published');

-- Public read: active ticket types belonging to a published event.
create policy "ticket_types: public read active"
  on public.ticket_types for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.events e
      where e.id = ticket_types.event_id
        and e.status = 'published'
    )
  );

-- Explicit table privileges for the public-readable tables (RLS still
-- gates the rows). All other tables have no anon/authenticated grants,
-- so they are reachable only via service_role.
grant select on public.events       to anon, authenticated;
grant select on public.ticket_types to anon, authenticated;
