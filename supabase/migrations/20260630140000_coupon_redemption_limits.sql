-- Coupon redemption limits: once per phone + max total uses per code.

create or replace function public.normalize_order_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
$$;

create or replace function public.count_coupon_redemptions(
  p_seller_user_id text,
  p_coupon_code text
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.orders o
  where trim(o.seller_user_id::text) = trim(p_seller_user_id)
    and coalesce(o.status, '') <> 'cancelled'
    and upper(trim(coalesce(o.checkout_adjustments ->> 'appliedCouponCode', ''))) =
        upper(trim(p_coupon_code));
$$;

create or replace function public.validate_storefront_coupon(
  p_seller_user_id text,
  p_coupon_code text,
  p_customer_whatsapp text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_rules jsonb;
  v_matched_rule jsonb := null;
  r jsonb;
  v_code text;
  v_once_per boolean;
  v_max_uses int;
  v_use_count bigint;
  v_phone_norm text;
begin
  if p_coupon_code is null or length(trim(p_coupon_code)) = 0 then
    return jsonb_build_object('valid', true);
  end if;

  if p_seller_user_id is null or length(trim(p_seller_user_id)) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'invalid_coupon');
  end if;

  v_code := upper(trim(p_coupon_code));

  select s.checkout_settings
  into v_settings
  from public.stores s
  where trim(s.seller_user_id::text) = trim(p_seller_user_id)
  limit 1;

  if v_settings is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_coupon');
  end if;

  v_rules := coalesce(v_settings -> 'rules', '[]'::jsonb);

  for r in select value from jsonb_array_elements(v_rules) as t(value)
  loop
    if coalesce((r ->> 'enabled')::boolean, true)
      and r ->> 'type' in ('coupon_percent', 'coupon_flat')
      and upper(trim(coalesce(r ->> 'code', ''))) = v_code
    then
      v_matched_rule := r;
      exit;
    end if;
  end loop;

  if v_matched_rule is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_coupon');
  end if;

  v_once_per := coalesce((v_matched_rule ->> 'oncePerCustomer')::boolean, false);
  v_max_uses := nullif((v_matched_rule ->> 'maxTotalUses')::int, 0);

  if v_max_uses is not null and v_max_uses > 0 then
    v_use_count := public.count_coupon_redemptions(p_seller_user_id, v_code);
    if v_use_count >= v_max_uses then
      return jsonb_build_object('valid', false, 'reason', 'max_uses_reached');
    end if;
  end if;

  if v_once_per then
    v_phone_norm := public.normalize_order_phone(p_customer_whatsapp);
    if v_phone_norm is null or length(v_phone_norm) < 8 then
      return jsonb_build_object('valid', false, 'reason', 'phone_required');
    end if;

    if exists (
      select 1
      from public.orders o
      where trim(o.seller_user_id::text) = trim(p_seller_user_id)
        and coalesce(o.status, '') <> 'cancelled'
        and upper(trim(coalesce(o.checkout_adjustments ->> 'appliedCouponCode', ''))) = v_code
        and public.normalize_order_phone(o.customer_whatsapp) = v_phone_norm
    ) then
      return jsonb_build_object('valid', false, 'reason', 'already_used_by_phone');
    end if;
  end if;

  return jsonb_build_object('valid', true);
end;
$$;

revoke all on function public.validate_storefront_coupon(text, text, text) from public;
grant execute on function public.validate_storefront_coupon(text, text, text) to anon, authenticated;

revoke all on function public.count_coupon_redemptions(text, text) from public;
grant execute on function public.count_coupon_redemptions(text, text) to authenticated;

create or replace function public.create_storefront_order(
  p_seller_user_id text,
  p_store_slug text,
  p_share_link_token text,
  p_customer_name text,
  p_customer_whatsapp text,
  p_items jsonb,
  p_total_amount numeric,
  p_currency_code text default 'INR',
  p_tracking_token text default null,
  p_payment_method text default null,
  p_checkout_adjustments jsonb default null,
  p_shipping_address jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orders%rowtype;
  v_share text;
  v_payment_method text;
  v_amount numeric;
  v_tracking text;
  v_coupon text;
  v_validation jsonb;
begin
  if p_seller_user_id is null or length(trim(p_seller_user_id)) = 0 then
    raise exception 'seller_required';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'customer_name_required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required';
  end if;

  v_coupon := upper(trim(coalesce(p_checkout_adjustments ->> 'appliedCouponCode', '')));
  if v_coupon <> '' then
    v_validation := public.validate_storefront_coupon(
      p_seller_user_id,
      v_coupon,
      coalesce(p_customer_whatsapp, '')
    );
    if coalesce((v_validation ->> 'valid')::boolean, false) is not true then
      raise exception 'coupon_not_allowed:%', coalesce(v_validation ->> 'reason', 'invalid_coupon');
    end if;
  end if;

  v_share := coalesce(
    nullif(trim(p_share_link_token), ''),
    'store:' || coalesce(nullif(trim(lower(p_store_slug)), ''), trim(p_seller_user_id))
  );

  v_payment_method := nullif(trim(coalesce(p_payment_method, '')), '');
  v_amount := coalesce(
    nullif((p_checkout_adjustments ->> 'grandTotal')::numeric, 0),
    p_total_amount
  );
  v_tracking := nullif(trim(coalesce(p_tracking_token, '')), '');

  begin
    insert into public.orders (
      share_link_token,
      seller_user_id,
      customer_name,
      customer_whatsapp,
      items,
      total_amount,
      currency_code,
      status,
      order_source,
      tracking_token,
      store_slug,
      payment_method,
      checkout_adjustments,
      shipping_address
    )
    values (
      v_share,
      trim(p_seller_user_id),
      trim(p_customer_name),
      nullif(trim(coalesce(p_customer_whatsapp, '')), ''),
      p_items,
      p_total_amount,
      coalesce(nullif(trim(p_currency_code), ''), 'INR'),
      'pending',
      'store',
      v_tracking,
      nullif(trim(lower(coalesce(p_store_slug, ''))), ''),
      v_payment_method,
      p_checkout_adjustments,
      p_shipping_address
    )
    returning * into v_row;
  exception
    when undefined_column then
      insert into public.orders (
        share_link_token,
        seller_user_id,
        customer_name,
        customer_whatsapp,
        items,
        total_amount,
        currency_code,
        status,
        order_source
      )
      values (
        v_share,
        trim(p_seller_user_id),
        trim(p_customer_name),
        nullif(trim(coalesce(p_customer_whatsapp, '')), ''),
        p_items,
        p_total_amount,
        coalesce(nullif(trim(p_currency_code), ''), 'INR'),
        'pending',
        'store'
      )
      returning * into v_row;
  end;

  if v_tracking is not null and length(v_tracking) >= 16 and coalesce(v_row.tracking_token, '') = '' then
    begin
      update public.orders
      set tracking_token = v_tracking, updated_at = now()
      where id = v_row.id
      returning * into v_row;
    exception
      when undefined_column then
        null;
    end;
  end if;

  if v_payment_method = 'upi' then
    begin
      insert into public.order_payments (
        order_id,
        seller_user_id,
        provider,
        status,
        amount,
        currency,
        payment_method,
        customer_name,
        customer_phone,
        metadata
      )
      values (
        v_row.id,
        v_row.seller_user_id,
        'upi',
        'pending',
        v_amount,
        coalesce(nullif(trim(p_currency_code), ''), 'INR'),
        'upi',
        trim(p_customer_name),
        nullif(trim(coalesce(p_customer_whatsapp, '')), ''),
        '{}'::jsonb
      )
      on conflict (order_id) do nothing;
    exception
      when undefined_table then
        null;
    end;
  end if;

  return to_jsonb(v_row);
end;
$$;
