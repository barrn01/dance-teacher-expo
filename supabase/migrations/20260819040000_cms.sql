-- ============================================================
-- Phase 2 — Program CMS: speakers, rooms, sessions (schedule).
--   Admin-managed content that will later power the public schedule +
--   speaker pages and the app. Published schedule model (no per-session
--   capacity/booking). Headline socials (Fashion Show, Lunch, Cocktail
--   Party) are modelled as sessions with a 'social' type.
--
--   RLS is enabled with NO anon policies for now — all access is via the
--   service client (server-side), same as the ticket pages. Public read
--   policies land with the public-facing pages in a later slice.
-- ============================================================

-- ---------- speakers ----------
create table public.speakers (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  name         text not null,
  slug         text not null,
  title        text,                 -- role, e.g. "Studio Owner & Choreographer"
  company      text,                 -- studio / brand
  bio          text,
  headshot_url text,
  website_url  text,
  instagram    text,
  is_featured  boolean not null default false,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (event_id, slug)
);
create index speakers_event_idx on public.speakers (event_id);
create trigger speakers_set_updated_at
  before update on public.speakers
  for each row execute function public.set_updated_at();

-- ---------- rooms ----------
create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  name       text not null,
  level      text,                   -- e.g. "Level 1"
  capacity   integer check (capacity is null or capacity >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_event_idx on public.rooms (event_id);
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------- sessions ----------
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  title         text not null,
  slug          text,
  description   text,
  session_type  text not null default 'workshop'
                  check (session_type in ('keynote', 'workshop', 'panel',
                                          'social', 'break', 'other')),
  room_id       uuid references public.rooms(id) on delete set null,
  session_date  date,                -- 2027-04-17 or 2027-04-18
  start_time    time,                -- Australia/Sydney local
  end_time      time,
  is_featured   boolean not null default false,
  is_published  boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index sessions_event_idx on public.sessions (event_id);
create index sessions_date_idx on public.sessions (session_date, start_time);
create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------- session_speakers (many-to-many) ----------
create table public.session_speakers (
  session_id uuid not null references public.sessions(id) on delete cascade,
  speaker_id uuid not null references public.speakers(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (session_id, speaker_id)
);
create index session_speakers_speaker_idx on public.session_speakers (speaker_id);

-- ---------- RLS (service-role only for now) ----------
alter table public.speakers         enable row level security;
alter table public.rooms            enable row level security;
alter table public.sessions         enable row level security;
alter table public.session_speakers enable row level security;

-- ---------- storage: public bucket for speaker headshots ----------
insert into storage.buckets (id, name, public)
values ('speaker-photos', 'speaker-photos', true)
on conflict (id) do nothing;
