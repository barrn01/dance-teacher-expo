-- ============================================================
-- Phase 2 — Vendor portal (exhibitor profiles)
--   A `vendors` row is created by an admin (company + package tier +
--   contact email). The vendor signs in with a magic link and is
--   identified by the email on their JWT (same pattern as the buyer
--   dashboard). They may READ their own row and UPDATE only their
--   exhibitor-profile fields (logo, blurb, socials, public contact).
--   Admin/service_role bypasses RLS and manages all vendor records.
--
--   Designed so `booths` and `vendor_documents` (private, RLS-secured
--   storage) can land later without reworking this table.
-- ============================================================

create extension if not exists citext;

create table public.vendors (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,
  -- Admin-owned fields ----------------------------------------------------
  company_name         text not null,
  slug                 text not null,
  package_family       text check (package_family in ('service', 'fashion')),
  package_tier         text check (package_tier in ('platinum', 'gold', 'silver', 'bronze')),
  contact_email        citext not null,          -- login identity
  contact_name         text,
  contact_phone        text,
  booth_number         text,                     -- assigned later
  status               text not null default 'active'
                         check (status in ('active', 'inactive')),
  -- Vendor-editable exhibitor profile -------------------------------------
  logo_url             text,
  description          text,
  website_url          text,
  instagram            text,
  facebook             text,
  public_contact_email citext,
  profile_completed_at timestamptz,              -- set when the profile is finished
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (event_id, slug)
);

create index vendors_event_idx on public.vendors (event_id);
create index vendors_email_idx on public.vendors (contact_email);

create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.vendors enable row level security;

-- A vendor reads only their own row (matched by JWT email).
create policy "vendors: vendor reads own"
  on public.vendors for select
  to authenticated
  using (contact_email = (select auth.email())::citext);

-- A vendor may update their own row; column privileges below restrict which
-- fields. with check mirrors using so they can't reassign the row's email.
create policy "vendors: vendor updates own"
  on public.vendors for update
  to authenticated
  using (contact_email = (select auth.email())::citext)
  with check (contact_email = (select auth.email())::citext);

-- RLS gates rows; column grant restricts editable fields to the profile.
grant select on public.vendors to authenticated;
grant update (logo_url, description, website_url, instagram, facebook, public_contact_email)
  on public.vendors to authenticated;

-- ---------- Storage: public bucket for vendor logos ----------
-- Logos are shown in the (future) exhibitor directory / app, so the bucket is
-- public-read. All writes go through our server (service_role) after checking
-- the caller owns the vendor row, so no object-level write policy is needed.
-- Private documents (insurance, contracts) get a SEPARATE secured bucket in
-- the vendor-documents slice — not here.
insert into storage.buckets (id, name, public)
values ('vendor-logos', 'vendor-logos', true)
on conflict (id) do nothing;
