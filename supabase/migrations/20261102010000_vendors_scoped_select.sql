-- Tighten the vendors SELECT grant for the `authenticated` role.
--
-- Previously `grant select on public.vendors to authenticated` exposed the whole
-- row. Combined with the own-row RLS policy that is not a cross-vendor leak, but
-- it let a signed-in vendor read their own admin-internal columns (contracted
-- amount_cents / outstanding_cents and the Xero invoice fields) directly via the
-- browser anon client. The app itself never reads vendors through the
-- authenticated role — every read uses the service client server-side — so we
-- can safely revoke the table-wide grant and re-grant only the vendor-facing
-- columns. Own-row RLS still applies on top.

revoke select on public.vendors from authenticated;

grant select (
  id,
  event_id,
  company_name,
  slug,
  package_family,
  package_tier,
  contact_email,
  contact_name,
  contact_phone,
  booth_number,
  status,
  logo_url,
  description,
  website_url,
  instagram,
  facebook,
  video_url,
  public_contact_email,
  profile_completed_at,
  created_at,
  updated_at
) on public.vendors to authenticated;
