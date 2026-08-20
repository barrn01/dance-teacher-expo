-- ============================================================
-- Unified attendee registration: one master list of everyone at the expo
-- (ticket holders, vendor staff, speakers), with a lead-gen category for
-- ticket holders.
--   * attendees.category  — Studio Owner / Teacher / Admin (ticket holders)
--   * attendees.speaker_id — links a registered speaker's attendee row back
--                            to their speaker record
--   * orders.registration_kind — marks non-sale registration orders (vendor
--                            staff, speakers) so they stay out of sales views.
--                            Backfills existing vendor orders.
--   * a non-sellable 'speaker_pass' ticket type for speaker check-in passes.
-- ============================================================

alter table public.attendees
  add column if not exists category text
    check (category is null or category in ('studio_owner', 'teacher', 'admin'));

alter table public.attendees
  add column if not exists speaker_id uuid
    references public.speakers(id) on delete set null;
create index if not exists attendees_speaker_idx on public.attendees (speaker_id);

alter table public.orders
  add column if not exists registration_kind text
    check (registration_kind is null
           or registration_kind in ('vendor_staff', 'speaker'));

-- Backfill: existing vendor-linked orders are vendor-staff registrations.
update public.orders
  set registration_kind = 'vendor_staff'
  where vendor_id is not null and registration_kind is null;

insert into public.ticket_types
  (event_id, key, name, description, price_cents, is_active, is_featured, sort_order, inclusions)
select id, 'speaker_pass', 'Speaker Pass',
       'Presenter / speaker pass — full event access.',
       0, false, false, 101, '["Full event access"]'::jsonb
from public.events where slug = 'dte-2027'
on conflict (event_id, key) do nothing;
