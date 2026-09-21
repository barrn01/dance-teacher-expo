-- Vendor HQ — Phase 2: in-platform vendor Pipeline.
-- Additive only (new tables + enums). See docs/vendor-hq/integration-plan.md §4.3.

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type public.prospect_stage as enum
    ('new','contacted','convo','verbal','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.touch_channel as enum ('call','sms','email','dm','note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.touch_direction as enum ('out','in');
exception when duplicate_object then null; end $$;

-- Prospects (pipeline leads) --------------------------------------------------
create table if not exists public.prospects (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id),
  name            text not null,
  ghl_contact_id  text,                 -- required before GHL messaging (Phase 3)
  tier            text,                 -- normalised from the artefact's free-text likelyTier
  type            text,                 -- service | fashion (nullable)
  potential_cents integer,              -- est. value ex GST; null => derive from tier price
  contact_person  text,
  contact_phone   text,
  contact_email   text,
  contact_insta   text,
  source          text,                 -- freeform provenance
  stage           public.prospect_stage not null default 'new',
  won_date        date,                 -- only when stage='won'
  won_vendor_id   uuid references public.vendors(id),  -- link on conversion
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists prospects_event_stage_idx on public.prospects (event_id, stage);
create index if not exists prospects_ghl_contact_idx on public.prospects (ghl_contact_id);

-- Touches (calls/sms/email/dm/note logged against a prospect) ------------------
create table if not exists public.prospect_touches (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid not null references public.prospects(id) on delete cascade,
  occurred_at         timestamptz not null default now(),
  channel             public.touch_channel not null,
  direction           public.touch_direction not null default 'out',
  body                text,
  by                  text,             -- admin login (out) / 'ghl' (in)
  ghl_message_id      text,
  ghl_conversation_id text
);
create index if not exists prospect_touches_prospect_idx
  on public.prospect_touches (prospect_id, occurred_at desc);

-- Notes (freeform, dated, attributed) -----------------------------------------
create table if not exists public.prospect_notes (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  by          text,
  text        text not null
);
create index if not exists prospect_notes_prospect_idx
  on public.prospect_notes (prospect_id, created_at desc);

-- RLS on from the start; admin access via the service client (bypasses RLS).
alter table public.prospects        enable row level security;
alter table public.prospect_touches enable row level security;
alter table public.prospect_notes   enable row level security;
