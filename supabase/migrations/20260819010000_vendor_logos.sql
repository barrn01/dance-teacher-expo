-- ============================================================
-- Vendors: support multiple purpose-tagged logos.
--   Marketing + the CMS need different logo shapes (a square for
--   app/directory tiles, a primary, a wide/horizontal, an optional
--   reversed/white for dark backgrounds). Store them as a small map
--   { slot -> public_url } in `logos`. The legacy `logo_url` is kept
--   in sync with the square (or primary) for any existing consumer.
-- ============================================================

alter table public.vendors
  add column if not exists logos jsonb not null default '{}'::jsonb;

-- Vendors edit their own logos via our server action (service_role), but grant
-- the column too so the RLS update path stays complete (defense in depth).
grant update (logos) on public.vendors to authenticated;
