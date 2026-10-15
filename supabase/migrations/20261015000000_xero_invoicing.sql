-- Xero vendor invoicing — auto-draft a sales invoice when a vendor signs.
-- Additive only (one new table + new nullable columns on vendors), safe to
-- apply to the live DB without touching the running site.

-- 1. Xero OAuth2 connection — single-row token store ----------------------------
-- Standard OAuth2 (authorization-code) flow. One Xero org (Dance Principals
-- United), so a single row holds the current tokens. The access token lasts
-- ~30 min; the refresh token rotates on every use and is kept here. Service
-- client only (tokens are secrets) — RLS denies everyone else.
create table if not exists public.xero_connection (
  id            text primary key default 'default' check (id = 'default'),
  tenant_id     text not null,            -- Xero tenantId (the org to post to)
  tenant_name   text,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,     -- when the access token expires
  scope         text,
  connected_by  text,                     -- admin email that authorised
  updated_at    timestamptz not null default now()
);

alter table public.xero_connection enable row level security;
-- No anon/authenticated policies -> denied by default; access via service client.

-- 2. Per-vendor Xero invoice tracking ------------------------------------------
-- Stores the draft we created so the webhook/button are idempotent (never
-- double-create) and the admin grid can show invoice state at a glance.
alter table public.vendors
  add column if not exists xero_contact_id     text,
  add column if not exists xero_invoice_id     text,
  add column if not exists xero_invoice_number text,
  add column if not exists xero_invoice_status text,        -- DRAFT|SUBMITTED|AUTHORISED|PAID|VOIDED (last seen)
  add column if not exists xero_invoiced_at    timestamptz,
  add column if not exists xero_last_error     text;        -- last create failure, for the retry UI
