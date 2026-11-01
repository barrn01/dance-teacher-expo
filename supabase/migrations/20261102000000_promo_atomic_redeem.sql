-- Atomic promo-code redemption.
--
-- Previously the redemption limit was enforced by a non-atomic read-check at
-- order creation (promo.ts validatePromo) and a separate non-atomic
-- read-modify-write increment at fulfilment. Nothing reserved the redemption in
-- between, so a capped code — especially a 100%-off comp code, whose $0 order is
-- fulfilled inline — could be redeemed far beyond max_redemptions under
-- concurrency (unlimited free tickets in the worst case).
--
-- redeem_promo() performs the check-and-increment in a single atomic UPDATE:
-- it only increments when the code is active and under its cap, and reports
-- whether a redemption was actually claimed. release_promo() is the
-- compensating action for the inline free-order path if fulfilment fails after
-- a claim.

create or replace function public.redeem_promo(p_promo_id uuid)
returns boolean
language plpgsql
as $$
declare
  claimed boolean;
begin
  update public.promo_codes
     set times_redeemed = times_redeemed + 1,
         updated_at = now()
   where id = p_promo_id
     and is_active = true
     and (max_redemptions is null or times_redeemed < max_redemptions)
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.release_promo(p_promo_id uuid)
returns void
language sql
as $$
  update public.promo_codes
     set times_redeemed = greatest(times_redeemed - 1, 0),
         updated_at = now()
   where id = p_promo_id;
$$;

-- Service-role only (called from server-only fulfilment/checkout code). Keep the
-- public API roles out of these counters.
revoke all on function public.redeem_promo(uuid) from public;
revoke all on function public.release_promo(uuid) from public;
grant execute on function public.redeem_promo(uuid) to service_role;
grant execute on function public.release_promo(uuid) to service_role;
