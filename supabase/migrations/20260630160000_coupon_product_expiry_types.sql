-- Product-based coupon types, expiry enforcement, and split category coupon types.

create or replace function public.order_item_matches_coupon_products(
  p_item jsonb,
  p_allowed jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_allowed text[];
  v_product_id text;
begin
  if p_allowed is null or jsonb_typeof(p_allowed) <> 'array' or jsonb_array_length(p_allowed) = 0 then
    return true;
  end if;

  select coalesce(array_agg(trim(value)), '{}'::text[])
  into v_allowed
  from jsonb_array_elements_text(p_allowed) as t(value)
  where length(trim(value)) > 0;

  if coalesce(array_length(v_allowed, 1), 0) = 0 then
    return true;
  end if;

  v_product_id := trim(coalesce(p_item ->> 'productId', p_item ->> 'product_id', ''));
  if v_product_id <> '' and v_product_id = any (v_allowed) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.validate_storefront_coupon(
  p_seller_user_id text,
  p_coupon_code text,
  p_customer_whatsapp text default '',
  p_items jsonb default null
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
  v_rule_type text;
  v_once_per boolean;
  v_max_uses int;
  v_use_count bigint;
  v_phone_norm text;
  v_allowed jsonb;
  v_item jsonb;
  v_has_eligible boolean := false;
  v_expires_at timestamptz;
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
      and r ->> 'type' in (
        'coupon_percent',
        'coupon_flat',
        'coupon_category_percent',
        'coupon_category_flat',
        'coupon_product_percent',
        'coupon_product_flat'
      )
      and upper(trim(coalesce(r ->> 'code', ''))) = v_code
    then
      v_matched_rule := r;
      exit;
    end if;
  end loop;

  if v_matched_rule is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_coupon');
  end if;

  if coalesce(v_matched_rule ->> 'expiresAt', '') <> '' then
    begin
      v_expires_at := (v_matched_rule ->> 'expiresAt')::timestamptz;
      if v_expires_at <= now() then
        return jsonb_build_object('valid', false, 'reason', 'coupon_expired');
      end if;
    exception
      when others then
        null;
    end;
  end if;

  v_rule_type := coalesce(v_matched_rule ->> 'type', '');

  if v_rule_type in ('coupon_category_percent', 'coupon_category_flat') then
    v_allowed := v_matched_rule -> 'allowedCategories';
    if v_allowed is null
      or jsonb_typeof(v_allowed) <> 'array'
      or jsonb_array_length(v_allowed) = 0
    then
      return jsonb_build_object('valid', false, 'reason', 'category_mismatch');
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      return jsonb_build_object('valid', false, 'reason', 'category_mismatch');
    end if;

    v_has_eligible := false;
    for v_item in select value from jsonb_array_elements(p_items) as t(value)
    loop
      if public.order_item_matches_coupon_categories(v_item, v_allowed) then
        v_has_eligible := true;
        exit;
      end if;
    end loop;

    if not v_has_eligible then
      return jsonb_build_object('valid', false, 'reason', 'category_mismatch');
    end if;
  end if;

  if v_rule_type in ('coupon_product_percent', 'coupon_product_flat') then
    v_allowed := v_matched_rule -> 'allowedProductIds';
    if v_allowed is null
      or jsonb_typeof(v_allowed) <> 'array'
      or jsonb_array_length(v_allowed) = 0
    then
      return jsonb_build_object('valid', false, 'reason', 'product_mismatch');
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      return jsonb_build_object('valid', false, 'reason', 'product_mismatch');
    end if;

    v_has_eligible := false;
    for v_item in select value from jsonb_array_elements(p_items) as t(value)
    loop
      if public.order_item_matches_coupon_products(v_item, v_allowed) then
        v_has_eligible := true;
        exit;
      end if;
    end loop;

    if not v_has_eligible then
      return jsonb_build_object('valid', false, 'reason', 'product_mismatch');
    end if;
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

revoke all on function public.validate_storefront_coupon(text, text, text, jsonb) from public;
grant execute on function public.validate_storefront_coupon(text, text, text, jsonb) to anon, authenticated;
