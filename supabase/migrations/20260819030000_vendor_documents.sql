-- ============================================================
-- Vendor documents (insurance, contracts, safety/compliance).
--   Sensitive files live in a PRIVATE storage bucket (vendor-documents,
--   public=false) — never a public URL. All access is via short-lived
--   signed URLs minted server-side after an ownership/admin check.
--   The `vendor_documents` table tracks metadata + a light review status.
-- ============================================================

create table public.vendor_documents (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors(id) on delete cascade,
  doc_type      text not null default 'other'
                  check (doc_type in ('insurance', 'contract', 'safety', 'other')),
  label         text,                 -- optional human label
  file_name     text not null,        -- original filename
  storage_path  text not null,        -- path within the private bucket
  content_type  text,
  size_bytes    integer,
  status        text not null default 'submitted'
                  check (status in ('submitted', 'approved', 'rejected')),
  uploaded_by   text,                 -- email of the uploader
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index vendor_documents_vendor_idx on public.vendor_documents (vendor_id);

create trigger vendor_documents_set_updated_at
  before update on public.vendor_documents
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.vendor_documents enable row level security;

-- A vendor may read their own document rows (metadata). File bytes are only
-- reachable via signed URLs we mint server-side. Writes go through service_role.
create policy "vendor_documents: vendor reads own"
  on public.vendor_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_documents.vendor_id
        and v.contact_email = (select auth.email())::citext
    )
  );

grant select on public.vendor_documents to authenticated;

-- ---------- Private storage bucket ----------
insert into storage.buckets (id, name, public)
values ('vendor-documents', 'vendor-documents', false)
on conflict (id) do nothing;
