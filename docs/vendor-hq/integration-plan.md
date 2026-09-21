# Vendor HQ — Integration Plan

Bringing the "Vendor HQ" artefact (a standalone static-HTML prototype) into the
live DTE 2027 admin (Next.js App Router + Supabase + Tailwind v4). This is the
single reference for building it out.

- **Source artefact:** `https://claude.ai/code/artifact/d99ae0fb-7bda-4de1-b01e-faf1949696ce`
- **Colleague handoff (full spec + source):** `~/Downloads/DTE-Vendor-HQ-Handoff.md`
- **Status:** planning complete, ready to build. Author will implement in Claude Code.

---

## 1. Goal & guiding principles

Turn the current `/admin/vendors` (a solid list + revenue rollup) into **Vendor HQ**:
a two-tab workspace —

1. **Booked vendors** — an at-a-glance readiness + money overview, so you can see
   who's missing a logo / booth / session / invoice **without drilling into each vendor**.
2. **Pipeline** — an in-platform kanban of prospective vendors, with the ability to
   **send SMS/email via GoHighLevel** directly from a card.

Principles (from `CLAUDE.md`):
- Boring, maintainable code; small non-technical team operates it.
- Staging-first: verify on a Vercel preview before production.
- Reuse the existing brand tokens in `src/app/globals.css` (`--color-pink #e23480`,
  `--color-char-2 #2b2127`, etc.) — do **not** reintroduce the artefact's raw hex.
- The artefact's storage/editing model (hardcoded arrays + localStorage overlay +
  "copy changes to Slack") is a no-backend workaround — **replace it, don't port it.**
  Writes go to Supabase; attribution comes from the admin login, not a name-picker.

---

## 2. Decisions locked

| Decision | Choice |
|---|---|
| Pipeline location | **In-platform** (Supabase is source of truth), migrating the artefact's ~195 prospects |
| Outbound comms | **Compose in-platform, send via GHL Conversations API** (GHL = transport + comms system-of-record) |
| Readiness statuses | Derive from real data where possible (logo/docs/staff), manual only where unavoidable (video, IG scheduled, funds received) |
| Attribution | Admin login (`updated_by`), never a self-selected name |

### Still open (resolve during Phase 1)
- **Money-lifecycle depth.** Track invoice-sent / funds-received per vendor *in-platform*,
  or lean on **Xero** (already connected) for the finance side and keep the platform to
  deposit + committed value? Recommendation: track lightweight status flags in-platform
  for the chase view; treat Xero as the accounting source of truth. Don't rebuild Xero.
- **`likelyTier` normalisation.** Artefact uses free text ("Gold Fashion", "Platinum Biz").
  Recommendation: split into `tier` + `type` on migration to match the vendor shape.

---

## 3. What exists today (reuse, don't rebuild)

`/admin/vendors` (`src/app/admin/vendors/page.tsx`) already has:
- Stat tiles: **Signed vendors, Committed (ex GST), Deposits locked** (`summariseVendors` in `src/lib/vendors.ts`).
- Per-tier breakdown pills.
- Vendor table: logo thumb, package (`family · tier`), contact, **staff count**, Complete/Pending badge.
- `isProfileComplete`, `primaryLogo`, `vendorLogos` (logos), `vendor_documents` (docs),
  staff via `attendees` joined to vendor-linked `orders`.
- Intake: idempotent `upsertVendorFromDeposit` + webhook `src/app/api/ghl/vendor-deposit/route.ts`.

Field mapping (artefact → existing `vendors`): `name→company_name`, `tier→package_tier`,
`type→package_family` (same values), `contact.person/phone/email→contact_name/phone/email`.
Roughly half of "Vendor HQ" is re-skinning data you already store.

---

## 4. Schema changes

Migrations live in `supabase/migrations/` (timestamped). Enable RLS on every new table
from the first migration; admin reads use the service client (bypasses RLS) like the
existing vendor code. **Reminder:** after applying to the live DB, run
`supabase migration repair --status applied <id>` to keep tracking clean.

### 4.1 Extend `vendors`
```sql
alter table public.vendors
  add column instagram        text,
  add column video_url        text,
  add column amount_cents      integer,   -- contracted total ex GST; default from tier price if null
  add column outstanding_cents integer;   -- independent of statuses; maintained by admin
```
`amount`/`outstanding` are **not** derived from the status flags (per the artefact) —
keep them explicit. `received = amount - outstanding` (header math only).

### 4.2 `vendor_statuses` — the readiness/money grid
Normalises the artefact's 10 embedded StatusObjects into rows. Makes the chase list a
trivial `where status = 'chase'`.
```sql
create type vendor_status_state as enum ('done','waiting','chase','na');

create table public.vendor_statuses (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.vendors(id) on delete cascade,
  field_key   text not null,          -- deposit|invoice|funds|video|ig_sched|app|booth|session|fashion
  status      vendor_status_state not null default 'waiting',
  display_date text,                   -- free-text display date e.g. "11 Sep" (optional)
  link         text,                   -- Drive URL → makes the cell clickable
  note         text,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  unique (vendor_id, field_key)
);
```
**Do NOT store `logo` here** — derive it from the existing logos (`primaryLogo`/`vendorLogos`).
Likewise derive `app`/docs from `vendor_documents` and staff from attendees where you can.
`vendor_statuses` is only for genuinely manual signals. `session`/`fashion` follow the
artefact rule: `na` unless tier ∈ {Platinum,Gold} and type matches (service→session, fashion→fashion).

### 4.3 Pipeline: `prospects` + touches + notes
```sql
create type prospect_stage   as enum ('new','contacted','convo','verbal','won','lost');
create type touch_channel     as enum ('call','sms','email','dm','note');
create type touch_direction   as enum ('out','in');

create table public.prospects (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id),
  name           text not null,
  ghl_contact_id text,                 -- REQUIRED to send via GHL; set on create / matched on migration
  tier           text,                 -- normalised from likelyTier
  type           text,                 -- service|fashion (nullable)
  potential_cents integer,             -- est value; fallback to tier price in a selector
  contact_person text, contact_phone text, contact_email text, contact_insta text,
  source         text,
  stage          prospect_stage not null default 'new',
  won_date       date,                 -- only when stage='won'
  won_vendor_id  uuid references public.vendors(id),  -- link on conversion
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.prospect_touches (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid not null references public.prospects(id) on delete cascade,
  occurred_at         timestamptz not null default now(),
  channel             touch_channel not null,
  direction           touch_direction not null default 'out',
  body                text,
  by                  text,            -- admin login (out) / GHL (in)
  ghl_message_id      text,
  ghl_conversation_id text
);

create table public.prospect_notes (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  by          text,
  text        text not null
);
```

### 4.4 Sponsorship target
Add to the event (or a small config). Artefact uses `TARGET = 400000` (ex GST).
```sql
alter table public.events add column sponsorship_target_cents integer;
```

---

## 5. GoHighLevel messaging integration

**Compose in the platform → send via GHL → log a touch.** GHL handles the sending
number/email domain, deliverability, DND/unsubscribe, and keeps the message in its
own conversation timeline.

### 5.1 Send
`POST https://services.leadconnectorhq.com/conversations/messages`
(auth: existing `GHL_API_KEY`; **verify the Private Integration has `conversations.write`
/ `conversations/message.write` scopes** — contact upsert alone doesn't grant these).

```jsonc
// SMS
{ "type": "SMS",   "contactId": "<prospect.ghl_contact_id>", "message": "..." }
// Email
{ "type": "Email", "contactId": "<...>", "subject": "...", "html": "<p>...</p>",
  "emailFrom": "<sender@links.danceprincipalsunited.com>" }
```
Returns `{ conversationId, messageId }`. On success write a `prospect_touches` row
(`channel`, `direction:'out'`, `by`=admin, `ghl_message_id`, `ghl_conversation_id`, `body`).

Wrap this in a server action, e.g. `src/app/admin/pipeline/actions.ts → sendProspectMessage()`.

### 5.2 Receive (replies) — pick one, later
- **Simple / v1:** poll `GET /conversations/{conversationId}/messages` (or search by
  `contactId`) when a card opens; render recent inbound.
- **Realtime / v2:** GHL inbound-message webhook → new route
  `src/app/api/ghl/inbound-message/route.ts` (mirror the secret-check pattern in
  `vendor-deposit/route.ts`) → append an `in` touch.

### 5.3 Gotchas
- Every prospect must have `ghl_contact_id`. On prospect create, upsert to GHL (reuse the
  contact upsert path) and store the id. Migration: match the 195 by email/phone.
- **Respect `dnd`/`dndSettings`** on the GHL contact — don't send to opted-out contacts.
- SMS needs a provisioned LC-Phone number + contact phone; Email uses the existing GHL domain.
- Optional: reuse GHL email templates via `templateId` (`emails_*` endpoints).

---

## 6. Views to build

### 6.1 Booked vendors (`/admin/vendors` — evolve the existing page)
Top→bottom (matches the artefact, restyled with brand tokens):
1. **Target header** — pledged $ of `sponsorship_target`, %, progress bar, Received / Outstanding / Still-to-sell.
2. **Tiles** — vendors booked, cash received, **items to chase**, days to event.
3. **Top of the chase list** — one row per vendor with ≥1 `chase` field (label + note), conditional.
4. **The grid** — sticky first column, horizontal scroll. Column groups:
   - **Money:** Amount, Outstanding, Deposit, Invoice, Funds
   - **Contact:** Person, Phone, Email, Insta
   - **Assets & promo:** Logo (derived), Video, IG sched., App entry
   - **Event:** Booth alloc., Session, Fashion show
   - **Notes**
5. **Legend** — the 4 status symbols + the note "flag".

Status cell = the artefact's `dotCell`: symbols `{done:'✓', waiting:'·', chase:'!', na:'—'}`,
a note-flag dot when `note` set and status≠done, clickable when `link` present.
Map colours to tokens: done→`good`/`good-bg`, chase→`warn`/`warn-bg`, waiting→`cell`, na→transparent.

### 6.2 Pipeline (`/admin/pipeline` — new)
- Columns: **New lead → Contacted → In convo → Verbal yes → 🎉 Won** (`lost` is a
  separate collapsed "Not this year" bucket with restore; never delete).
- Card: name, tier/est-value, source, last-touch meter with **gone-quiet** badge, history.
- Card actions (all write to Supabase): move stage (buttons + drag-drop), **send SMS/email
  (§5)**, log a touch, add a note, edit details. Moving to Won sets `won_date` and offers
  **create/link a `vendors` row** (`won_vendor_id`).
- Pulse tiles: in play, in conversation, potential if all closed, gone-quiet, won so far.

---

## 7. Design-fresh logic (better than the artefact)
- **Auto-chase:** artefact sets `chase` by hand. Add rules, e.g. logo still `waiting` <30d
  to event, invoice `waiting` after deposit `done` >Nd, etc. Surface as computed, not stored.
- **Gone-quiet:** prospect not won/lost, not new, last touch >14d ago (`QUIET_DAYS=14`).
  Now computable from real `prospect_touches` dates.
- **Won → vendor:** on Won, offer to create/link a `vendors` row (ties into the existing
  deposit backfill flow). Artefact had no link between the two.
- **Standardise dates** to real `timestamptz`/`date` (artefact mixes free-text and ISO).

---

## 8. Phasing

- **Phase 1 — Booked overview (no pipeline).** `vendors` extensions + `vendor_statuses` +
  target; rebuild `/admin/vendors` as the readiness grid using mostly existing data.
  Delivers the "see what's missing at a glance" win. Resolve the money/Xero + normalisation
  open questions here.
- **Phase 2 — Pipeline (read/write, no GHL send yet).** `prospects`/touches/notes tables,
  migrate the 195, kanban board with stage moves + notes + touches.
- **Phase 3 — GHL messaging.** Verify scopes, send SMS/email from cards, auto-log touches;
  add reply sync (poll first, webhook later).
- **Phase 4 — Auto-chase + won→vendor + polish.**

---

## 9. Migration: the ~195 prospects
Source data is the `PROSPECTS` array in the handoff file's source section. On import:
- Normalise `likelyTier` → `tier` + `type`; keep `potential` → `potential_cents`.
- Match each to a GHL contact by email/phone → set `ghl_contact_id` (create in GHL if absent).
- Preserve `touches`/`notes` (with `by`; treat the one-time `"import"` author as system).
- Map `stage` values directly (enum matches).
- `source` stays free text.

## 10. Files likely touched / added
- `supabase/migrations/<ts>_vendor_hq.sql` — all schema above
- `src/lib/vendors.ts` — status helpers, readiness derivation, target math
- `src/lib/prospects.ts` (new) — pipeline queries, gone-quiet/estValue selectors
- `src/lib/ghl.ts` (new or extend) — `sendConversationMessage`, contact upsert reuse
- `src/app/admin/vendors/page.tsx` — evolve into Booked overview
- `src/app/admin/pipeline/page.tsx` + `actions.ts` (new) — pipeline board + server actions
- `src/app/api/ghl/inbound-message/route.ts` (new, Phase 3 webhook)
- `src/components/admin/*` — grid, status cell, kanban card, message composer
