-- Studio / company name for ticket holders.
--
-- Collected per attendee at checkout (required). We also keep the purchaser's
-- own studio on the order, so the buyer's GHL contact gets a company even when
-- the buyer isn't themselves an attendee (e.g. a multi-ticket team order).
--
-- On paid orders both flow to GHL as the contact's companyName, feeding
-- exhibitor lead workflows alongside the existing role tags.

alter table public.attendees
  add column if not exists studio_name text;

alter table public.orders
  add column if not exists buyer_company text;
