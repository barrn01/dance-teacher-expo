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

-- Two Day All Access — the only 2027 ticket. One SKU whose per-person
-- price slides with quantity (the "group rate applies automatically as you
-- add attendees"). No One-Day ticket for 2027 (dropped deliberately — do
-- not add back without Nathan's say-so).
--
-- Pricing (GST inc):
--   1 person      $329 pp
--   2-4 people    $299 pp
--   5+ people     $239 pp   (== "Buy 4, get 1 free": 4 x $299 ≈ 5 x $239)
insert into public.ticket_types
  (event_id, key, name, description, price_cents, inc_gst, min_quantity, max_quantity,
   inclusions, pricing_rules, is_featured, is_active, sort_order)
select
  e.id,
  'two_day_all_access',
  'Two Day All Access',
  'The full weekend — both days of the expo, your pick of 50+ sessions, and every headline event. Bringing your team? The group rate kicks in automatically as you add attendees.',
  32900,   -- "from" / single-person price
  true,
  1,
  20,      -- soft cap per order; groups above this can contact us
  '["Two full days of expo entry","Your pick of 50+ sessions","Lunch on both days","Fashion Show + Cocktail Party","Event app access"]'::jsonb,
  '{"per_person_tiers":[{"min_qty":1,"price_cents":32900},{"min_qty":2,"price_cents":29900},{"min_qty":5,"price_cents":23900}]}'::jsonb,
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
