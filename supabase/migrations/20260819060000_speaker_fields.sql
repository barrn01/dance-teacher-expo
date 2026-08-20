-- Richer speaker/teacher fields: pronouns, a one-line tagline (separate from
-- bio), and a distinct "featured on homepage" flag (vs is_featured = featured
-- in the listing).
alter table public.speakers add column if not exists pronouns text;
alter table public.speakers add column if not exists tagline text;
alter table public.speakers
  add column if not exists is_homepage_featured boolean not null default false;
