create or replace function public.get_seller_checkout_features(p_seller_user_id text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'integrationFlags', coalesce(s.integration_flags, '{"razorpay":false,"shiprocket":false}'::jsonb),
        'checkoutSettings', coalesce(
          s.checkout_settings,
          '{"version":1,"rules":[],"showBreakdown":true,"allowCouponEntry":true,"enableCod":false}'::jsonb
        )
      )
      from public.stores s
      where s.seller_user_id = p_seller_user_id
      limit 1
    ),
    jsonb_build_object(
      'integrationFlags', '{"razorpay":false,"shiprocket":false}'::jsonb,
      'checkoutSettings', '{"version":1,"rules":[],"showBreakdown":true,"allowCouponEntry":true,"enableCod":false}'::jsonb
    )
  );
$$;

revoke all on function public.get_seller_checkout_features(text) from public;
grant execute on function public.get_seller_checkout_features(text) to anon, authenticated;
