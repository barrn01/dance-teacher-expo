# Dance Teacher Expo 2027 — Ticketing Platform

Custom event platform for Dance Teacher Expo 2027, replacing an Entegy app/ticketing stack. It starts as attendee ticketing and grows into the full event platform (public website, vendor portal, speaker/schedule management, admin dashboard, and the API behind iOS/Android apps).

**Brief updated 10 August 2026.** An earlier version of this file carried a design system derived from danceprincipalsunited.com (VeniceBlvd fonts, warm pastel palette). That is **superseded** — DTE 2027 now has its own published brand, documented below and in `design/`. Ignore any older references.

## The event

- **Dance Teacher Expo 2027** — Australia's biggest professional development event for dance teachers and studio owners.
- **Sat 17 & Sun 18 April 2027**, **Grand Pavilion, Rosehill Gardens, Sydney**. New venue for 2027 (2026 was ICC Sydney): two full levels, free onsite parking. The move is a headline marketing message.
- Scale: 50+ sessions across multiple concurrent rooms, ~1,000 dance educators, 50+ exhibiting brands, plus a Saturday-night Fashion Show, Grand Opening Lunch and Cocktail Party.
- Owner: Nathan (nathan@danceprincipalsunited.com). Sister brand: danceprincipalsunited.com.
- Instagram: @danceteacherexpo

## What already exists (do not rebuild)

Marketing and vendor sales for 2027 are **already live in GoHighLevel** and converting. Leave them alone this phase:

- Save-the-date page (currently promises "ticket details coming soon" — our first job is to make that link somewhere real).
- Vendor prospectus + `vendor.danceteacherexpo.com.au/2027deposit` order and thank-you funnel.
- Vendor packages, for context: Service and Fashion families × Platinum $10,500 / Gold $6,000 / Silver $4,500 / Bronze $3,500 (+GST), $500 deposit to lock a tier. Add-ons: coffee cart $2,000/day, lanyards $3,500, goody bag POA, cocktail party POA, catwalk production $1,500.

Vendor management (profiles, booths, documents) moves into this platform in a later phase, not now.

## Tech stack (decided — do not substitute)

- **Next.js** (App Router, TypeScript, Tailwind) on **Vercel**.
- **Supabase** — Postgres (**Sydney, ap-southeast-2** — project already created), Auth, Storage. Single source of truth.
- **Stripe** (existing DTE account) — Payment Element embedded on our own domain. Never redirect off-site to pay.
- **Resend** — transactional email (order confirmation, QR ticket delivery).
- **Go High Level** — marketing comms only. On every purchase, upsert the contact to GHL via API with tags (`DTE2027-purchaser`, ticket type). Do **not** build marketing email/SMS into the platform.
- **Meta Conversions API** — server-side events with `event_id` dedup against the browser Pixel.

## Phase 1 scope — ticketing first

**Goal: attendee tickets on sale as soon as the checkout is tested and working.** Ship narrow and solid rather than broad.

Deploy to **`tickets.danceteacherexpo.com.au`**. Because that is a subdomain of the same root domain as the GHL marketing pages, Meta cookies (`_fbp`/`_fbc`) carry across the handoff — set the cookie domain to `.danceteacherexpo.com.au` so attribution survives. The GHL save-the-date links here; everything from landing to purchase is ours.

Build in this order:

1. **Foundations** — Next.js scaffold, push to GitHub (`barrn01/dance-teacher-expo`, private), Vercel project with preview + production environments, Supabase linked. First milestone: a branded holding page live on a Vercel URL that Nathan can open on his phone.
2. **Data model** — see below; migrations in-repo, RLS enabled from the first table.
3. **Ticket pages** — ticket selection using the brand system in `design/`. Mobile-first: most buyers are on phones.
4. **Checkout** — Stripe Payment Element on-domain; multi-attendee purchase (buyer supplies each attendee's name/email); webhook is the source of truth → creates order, issues one QR ticket per attendee, sends confirmation via Resend. Test mode end-to-end before live keys.
5. **Tracking + GHL sync** — Pixel + server-side CAPI (PageView, ViewContent, InitiateCheckout, Purchase) with `event_id` dedup, `fbp`/`fbc`, hashed email/phone; GHL contact upsert on purchase.
6. **Admin basics** — orders and attendees list, refunds, comp tickets, CSV export, ticket-type/pricing editing.
7. **Go live** — DNS for the subdomain, live Stripe keys, one real purchase + refund as a smoke test, privacy policy and refund terms published.

Out of scope for Phase 1 (but keep the data model ready): full public website migration, vendor portal, speaker profiles, schedule builder, mobile apps, door check-in.

## Ticket pricing (2026 structure carried over; build config-driven so it is editable in admin without code changes)

- Two-Day All Access: **$329 per attendee** — 2-day expo entry, 50+ sessions, **lunch on both days**, fashion show, cocktail party, event app. This is the only ticket type.
- **Marginal / position-based pricing** (confirmed by Nathan, Aug 2026; supersedes the old $299/$239 sliding scale): tickets **1–4 are $329 each**, the **5th is free** ("buy 4, get the 5th free"), and **every ticket from the 6th onward is $249**. One free ticket per order (not repeating).
- **No one-day ticket for 2027** — dropped deliberately so pricing does not start from a low anchor. Do not reintroduce it without Nathan saying so.
- All AUD, inc GST (note vendor pricing is quoted +GST; attendee pricing is inc). Support promo codes.

Pricing lives in the `ticket_types` config as ordered `pricing_rules.price_bands` (by ticket position), editable without code changes.

## Data model

Phase 1 tables: `events`, `ticket_types` (pricing tiers and rules as config), `orders`, `order_items`, `tickets` (one per attendee, unique QR token), `attendees`, `promo_codes`.

Design so these can land later without rework: `vendors`, `booths`, `vendor_documents`, `speakers`, `sessions`, `rooms`, `agenda_items`.

RLS on from the start. Attendee PII minimised and access-controlled — Australian Privacy Act applies. Card data never touches our servers (Stripe, PCI SAQ-A).

## Design system — DTE 2027 brand

`design/brand.css` holds the real tokens and component patterns, lifted from the live 2027 pages. `design/dte27-logo.svg` is the logo. Import the CSS or port the tokens into the Tailwind theme — do not invent new brand colours.

- **Palette:** ink `#171114` (the default page surface — this brand is dark), pink `#E23480` (primary), pink-hot `#F04590` (accent words, hover), ballet `#FFADCC` (eyebrows/labels on dark), paper `#FFF6FA` (light sections), char-2 `#2B2127` (raised cards on dark), black `#000` (footer).
- **Type:** **Anton** for uppercase display headlines (tight leading, oversized), **Montserrat** for all body and UI (700/800 for labels, wide letter-spacing on eyebrows), **Caveat** for short handwritten leads only ("Save the date", "Rosehill is calling").
- **Devices:** pink radial glow behind hero and closing sections; outlined-stroke year treatment; pill buttons; uppercase chips for date/venue; a full-width pink stat strip; tilted script badges; light "paper" sections to break up the dark; real event photography, slightly rotated with soft shadows.
- **Voice:** warm, direct, a little cheeky, never corporate. Short sentences. Talks to studio owners as peers.

Attendee-facing ticket pages may lean lighter than the vendor prospectus (more paper and ballet-pink, less full black) so buying feels friendly — but same palette, fonts and logo throughout.

## Conventions

- Staging first: verify every feature on a preview URL before production. Nathan reviews on his phone.
- Stripe webhooks are the source of truth for order state; handle idempotently and verify signatures.
- Secrets in Vercel/Supabase env vars only; never commit them.
- Prefer boring, maintainable code — operated by a small non-technical team with Claude Code as the ongoing dev partner.
- Money in integer cents; all times Australia/Sydney.

## First session task

Scaffold the app (Next.js + TypeScript + Tailwind), wire GitHub, Vercel and the existing Supabase project, port the brand tokens from `design/brand.css`, create the initial migration for the Phase 1 tables, and ship a branded "Tickets coming soon" holding page to a preview URL. Then work through Phase 1 in order.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
