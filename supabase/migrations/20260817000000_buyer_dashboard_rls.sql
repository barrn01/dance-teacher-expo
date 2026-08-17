-- ============================================================
-- Buyer self-service dashboard — RLS for authenticated purchasers.
--   A purchaser signs in (magic link) and is identified by the email on
--   their JWT. They may READ the orders they bought (and the order_items,
--   tickets and attendees under them), and UPDATE their attendees' details
--   (name/email/phone) — e.g. to fill in or swap a staff member.
--   The Stripe webhook keeps writing via service_role (bypasses RLS).
--   auth.email() is wrapped in a scalar subselect so it evaluates once.
-- ============================================================

-- Helper predicate is inlined per policy (Postgres has no policy-shared
-- expressions); each checks the row's order belongs to the caller's email.

-- orders: a buyer reads their own orders.
create policy "orders: buyer reads own"
  on public.orders for select
  to authenticated
  using (buyer_email = (select auth.email())::citext);

-- order_items: readable when the parent order is the caller's.
create policy "order_items: buyer reads own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.buyer_email = (select auth.email())::citext
    )
  );

-- tickets: readable when the parent order is the caller's.
create policy "tickets: buyer reads own"
  on public.tickets for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = tickets.order_id
        and o.buyer_email = (select auth.email())::citext
    )
  );

-- attendees: readable when the parent order is the caller's.
create policy "attendees: buyer reads own"
  on public.attendees for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = attendees.order_id
        and o.buyer_email = (select auth.email())::citext
    )
  );

-- attendees: a buyer may update their own attendees (column privileges below
-- restrict which fields). with check mirrors using so they can't reassign an
-- attendee to another buyer's order.
create policy "attendees: buyer updates own"
  on public.attendees for update
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = attendees.order_id
        and o.buyer_email = (select auth.email())::citext
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = attendees.order_id
        and o.buyer_email = (select auth.email())::citext
    )
  );

-- Table privileges. RLS still gates the rows; anon gets nothing here.
grant select on public.orders      to authenticated;
grant select on public.order_items to authenticated;
grant select on public.tickets     to authenticated;
grant select on public.attendees   to authenticated;
-- Buyers may only edit these attendee columns (not order_id/ticket_type_id).
grant update (first_name, last_name, email, phone) on public.attendees to authenticated;
