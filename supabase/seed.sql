-- ============================================================
-- DTE 2027 — local/dev seed data
-- Loaded by `supabase db reset`. Working defaults per CLAUDE.md;
-- confirm exact 2027 tiers with Nathan before go-live.
--
-- NOTE: the event is seeded as 'draft' so anon RLS does NOT expose
-- ticket types yet. Flip status to 'published' when tickets go on sale.
-- ============================================================

insert into public.events (slug, name, status, start_at, end_at, timezone, venue_name, venue_address, currency)
values (
  'dte-2027',
  'Dance Teacher Expo 2027',
  'draft',
  '2027-04-17 09:00:00+10',  -- Sat 17 Apr 2027, AEST
  '2027-04-18 17:00:00+10',  -- Sun 18 Apr 2027, AEST
  'Australia/Sydney',
  'Grand Pavilion, Rosehill Gardens',
  'James Ruse Dr, Rosehill NSW 2142',
  'AUD'
)
on conflict (slug) do update
  set name = excluded.name,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      venue_name = excluded.venue_name,
      venue_address = excluded.venue_address;

-- Two-Day All Access — $329, GST inc. The anchor / most popular tier.
insert into public.ticket_types
  (event_id, key, name, description, price_cents, inc_gst, min_quantity,
   inclusions, pricing_rules, is_featured, is_active, sort_order)
select
  e.id,
  'two_day_all_access',
  'Two Day All Access',
  'The full weekend — both days of the expo, your pick of 50+ sessions, and every headline event.',
  32900,
  true,
  1,
  '["Two full days of expo entry","Your pick of 50+ sessions","Lunch on both days","Fashion Show + Cocktail Party","Event app access"]'::jsonb,
  '{}'::jsonb,
  true,
  true,
  10
from public.events e where e.slug = 'dte-2027'
on conflict (event_id, key) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      inclusions = excluded.inclusions,
      is_featured = excluded.is_featured,
      sort_order = excluded.sort_order;

-- Studio Group — same all-access ticket at the group rate. Config-driven:
-- group rate applies from 2 tickets ($299 pp), sliding to $239 pp at 5,
-- plus Buy 4 Get 1 Free. Editable in admin without code changes.
-- NOTE: no One-Day ticket for 2027 (dropped deliberately — do not add
-- back without Nathan's say-so).
insert into public.ticket_types
  (event_id, key, name, description, price_cents, inc_gst, min_quantity,
   inclusions, pricing_rules, is_featured, is_active, sort_order)
select
  e.id,
  'studio_group',
  'Studio Group',
  'Bring the team. The group rate kicks in from 2 tickets, in one checkout with one invoice.',
  29900,  -- per-person rate at 2+ (the group entry price)
  true,
  2,
  '["Everything in All Access","Group rate from 2 tickets","One checkout, one invoice"]'::jsonb,
  '{"per_person_tiers":[{"min_qty":2,"price_cents":29900},{"min_qty":5,"price_cents":23900}],"buy_x_get_y":{"buy":4,"free":1}}'::jsonb,
  false,
  true,
  20
from public.events e where e.slug = 'dte-2027'
on conflict (event_id, key) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      min_quantity = excluded.min_quantity,
      inclusions = excluded.inclusions,
      pricing_rules = excluded.pricing_rules,
      sort_order = excluded.sort_order;
