-- Vendor HQ — Phase 1: Booked-vendor readiness overview
-- Additive only (new nullable columns + new tables), so it is safe to apply to
-- the live DB without touching the running site or existing admin.
-- See docs/vendor-hq/integration-plan.md §4.

-- 1. Vendor money + promo fields ------------------------------------------------
alter table public.vendors
  add column if not exists instagram         text,
  add column if not exists video_url         text,
  add column if not exists amount_cents       integer,  -- contracted total ex GST; null => derive from tier price
  add column if not exists outstanding_cents  integer;  -- independent of statuses; maintained by admin

-- 2. Sponsorship target (event-level) ------------------------------------------
alter table public.events
  add column if not exists sponsorship_target_cents integer;  -- artefact default: $400,000 -> 40000000

-- 3. Per-vendor readiness / money statuses -------------------------------------
-- Normalises the artefact's embedded StatusObjects into rows so the "chase list"
-- is a `where status = 'chase'` query. Only for MANUAL signals — logo/docs/staff
-- are derived from existing data and must NOT be duplicated here.
do $$ begin
  create type public.vendor_status_state as enum ('done','waiting','chase','na');
exception when duplicate_object then null; end $$;

create table if not exists public.vendor_statuses (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors(id) on delete cascade,
  field_key    text not null,   -- deposit|invoice|funds|video|ig_sched|app|booth|session|fashion
  status       public.vendor_status_state not null default 'waiting',
  display_date text,            -- free-text display date, e.g. "11 Sep" (optional)
  link         text,            -- Drive URL -> makes the grid cell clickable
  note         text,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  unique (vendor_id, field_key)
);

create index if not exists vendor_statuses_vendor_id_idx on public.vendor_statuses (vendor_id);
create index if not exists vendor_statuses_chase_idx on public.vendor_statuses (status) where status = 'chase';

-- RLS on from the start. Admin reads/writes go through the service client
-- (bypasses RLS), matching the rest of the vendor admin. No anon/authenticated
-- policies -> denied by default.
alter table public.vendor_statuses enable row level security;
