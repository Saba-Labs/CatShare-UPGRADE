-- Ensure storefront orders keep tracking_token even on legacy fallback inserts.

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
