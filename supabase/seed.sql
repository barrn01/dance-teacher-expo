-- ============================================================
-- DTE 2027 — local/dev seed data
-- Loaded by `supabase db reset`. Prices are the 2026 structure
-- carried into 2027 (confirmed by Nathan, Aug 2026).
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

-- Two Day All Access — the only 2027 ticket. $329 flat per attendee, with
-- "Buy 4, get 1 free": every 5th ticket in an order is free (confirmed by
-- Nathan, Aug 2026). No One-Day ticket for 2027 (dropped deliberately — do
-- not add back without Nathan's say-so).
insert into public.ticket_types
  (event_id, key, name, description, price_cents, inc_gst, min_quantity, max_quantity,
   inclusions, pricing_rules, is_featured, is_active, sort_order)
select
  e.id,
  'two_day_all_access',
  'Two Day All Access',
  'The full weekend — both days of the expo, your pick of 50+ sessions, and every headline event, plus lunch on both days.',
  32900,   -- $329 per attendee, GST inc
  true,
  1,
  20,      -- soft cap per order; larger groups can contact us
  '["Two full days of expo entry","Your pick of 50+ sessions","Lunch on both days","Fashion Show + Cocktail Party","Event app access"]'::jsonb,
  '{"buy_x_get_y":{"buy":4,"free":1}}'::jsonb,
  true,
  true,
  10
from public.events e where e.slug = 'dte-2027'
on conflict (event_id, key) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      min_quantity = excluded.min_quantity,
      max_quantity = excluded.max_quantity,
      inclusions = excluded.inclusions,
      pricing_rules = excluded.pricing_rules,
      is_featured = excluded.is_featured,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

-- Deactivate the old separate Studio Group SKU if a previous seed created it
-- (superseded by quantity tiers on Two Day All Access).
update public.ticket_types tt
  set is_active = false
  from public.events e
  where tt.event_id = e.id and e.slug = 'dte-2027' and tt.key = 'studio_group';
