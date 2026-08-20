-- ============================================================
-- Vendor attending staff.
--   Vendors add their booth staff in the exhibitor portal; each becomes a
--   real attendee + QR pass so they flow through door check-in and the
--   attendee exports. Staff sit on a $0 order linked to the vendor
--   (orders.vendor_id) and use a dedicated, non-sellable "Exhibitor Staff"
--   ticket type so they're labelled distinctly and never counted as sales.
-- ============================================================

alter table public.orders
  add column if not exists vendor_id uuid references public.vendors(id) on delete cascade;

create index if not exists orders_vendor_idx on public.orders (vendor_id);

-- Non-sellable exhibitor-staff pass type (is_active = false → never shown on
-- sale or via the public read policy; used only for vendor staff passes).
insert into public.ticket_types
  (event_id, key, name, description, price_cents, is_active, is_featured, sort_order, inclusions)
select id, 'exhibitor_staff', 'Exhibitor Staff',
       'Exhibitor booth staff pass — full event access for working staff.',
       0, false, false, 100, '["Two full days of expo access"]'::jsonb
from public.events
where slug = 'dte-2027'
on conflict (event_id, key) do nothing;
