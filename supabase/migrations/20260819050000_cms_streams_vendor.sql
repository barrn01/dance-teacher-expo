-- ============================================================
-- CMS refinements:
--   * sessions get a `stream` (Business / Movement track).
--   * speakers/teachers can be linked to a vendor (some vendor packages
--     include a speaking/teaching slot).
-- ============================================================

alter table public.sessions
  add column if not exists stream text
    check (stream is null or stream in ('business', 'movement'));

alter table public.speakers
  add column if not exists vendor_id uuid
    references public.vendors(id) on delete set null;

create index if not exists speakers_vendor_idx on public.speakers (vendor_id);
