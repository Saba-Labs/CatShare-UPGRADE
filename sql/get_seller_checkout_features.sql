-- Public checkout features for store + order-link checkout (anon-safe via security definer).
-- Integration flags are read live from seller_integrations (not stale store cache).
create or replace function public.get_seller_checkout_features(p_seller_user_id text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with live_flags as (
    select jsonb_build_object(
      'razorpay', exists (
        select 1
        from public.seller_integrations si
        where si.seller_user_id = p_seller_user_id
          and si.provider = 'razorpay'
          and si.status = 'connected'
          and coalesce(si.metadata->>'isDemo', 'false') <> 'true'
      ),
      'shiprocket', exists (
        select 1
        from public.seller_integrations si
        where si.seller_user_id = p_seller_user_id
          and si.provider = 'shiprocket'
          and si.status = 'connected'
          and coalesce(si.metadata->>'isDemo', 'false') <> 'true'
      )
    ) as flags
  ),
  store_row as (
    select s.checkout_settings
    from public.stores s
    where s.seller_user_id = p_seller_user_id
    limit 1
  )
  select jsonb_build_object(
    'integrationFlags', (select flags from live_flags),
    'checkoutSettings', coalesce(
      (select checkout_settings from store_row),
      '{"version":1,"rules":[],"showBreakdown":true,"allowCouponEntry":true,"enableCod":false}'::jsonb
    )
  );
$$;

revoke all on function public.get_seller_checkout_features(text) from public;
grant execute on function public.get_seller_checkout_features(text) to anon, authenticated;
