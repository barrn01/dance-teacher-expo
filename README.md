# Dance Teacher Expo 2027 — Ticketing Platform

Custom event platform for **Dance Teacher Expo 2027** (Sat 17 & Sun 18 April 2027,
Grand Pavilion, Rosehill Gardens, Sydney). Phase 1 is attendee ticketing; it grows
into the full event platform later. See [`CLAUDE.md`](./CLAUDE.md) for the full brief
and [`design/`](./design/) for the brand system.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind v4) on **Vercel**
- **Supabase** — Postgres (Sydney `ap-southeast-2`), Auth, Storage — single source of truth
- **Stripe** — Payment Element, on-domain; webhook is the source of truth for order state
- **Resend** — transactional email (confirmation + QR ticket)
- **Go High Level** — marketing sync only (contact upsert + tags on purchase)
- **Meta Conversions API** — server-side events with `event_id` dedup

Production target: **`tickets.danceteacherexpo.com.au`**.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000 — the holding page
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Environment

All variables are documented in [`.env.example`](./.env.example). `NEXT_PUBLIC_*`
values reach the browser; everything else is server-only. The cookie domain is set to
`.danceteacherexpo.com.au` so Meta's `_fbp`/`_fbc` carry across the GHL → tickets handoff.

## Database

Migrations live in [`supabase/migrations/`](./supabase/migrations/); local dev seed data
in [`supabase/seed.sql`](./supabase/seed.sql). RLS is on for every table from the first
migration — `service_role` (the Stripe webhook) drives writes; anon may only read
published events and their active ticket types.

Phase 1 tables: `events`, `ticket_types` (pricing as editable config), `promo_codes`,
`orders`, `order_items`, `attendees`, `tickets` (one per attendee, unique QR token).

```bash
supabase link --project-ref <your-project-ref>   # one-time, links the Sydney project
supabase db push                                 # apply migrations to the remote DB
supabase db reset                                # local only: re-run migrations + seed
```

## Deploy (Vercel)

```bash
vercel link            # link to the Vercel project (barrn01)
vercel                 # deploy a preview
vercel --prod          # deploy production
```

Set env vars in the Vercel project (Preview + Production) matching `.env.example`.
Verify on the preview URL first — Nathan reviews on his phone — before promoting.

## Brand

Tokens are ported from [`design/brand.css`](./design/brand.css) into
[`src/app/globals.css`](./src/app/globals.css) (Tailwind `@theme`), with Anton /
Montserrat / Caveat wired via `next/font` in `src/app/layout.tsx`. Do not introduce
colours or fonts outside the brand system.

## Status

Phase 1, step 1 (foundations) — branded "Tickets coming soon" holding page + data model.
Next: ticket selection pages, then Stripe checkout. Work through the Phase 1 order in
`CLAUDE.md`.
