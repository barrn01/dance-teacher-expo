-- Let a signed-in buyer edit their attendees' lead-gen category (RLS still
-- restricts to their own orders; this just adds the column to the grant).
grant update (category) on public.attendees to authenticated;
