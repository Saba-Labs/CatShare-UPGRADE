-- UPI checkout: create order_payments on place + let customers mark paid via tracking token.

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
      nullif(trim(coalesce(p_tracking_token, '')), ''),
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

create or replace function public.claim_upi_payment_by_tracking_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.order_payments%rowtype;
  v_now timestamptz := now();
  v_amount numeric;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'invalid_token';
  end if;

  select * into v_order
  from public.orders
  where tracking_token = trim(p_token);

  if not found then
    raise exception 'order_not_found';
  end if;

  if coalesce(v_order.payment_method, '') <> 'upi' then
    raise exception 'not_upi_order';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;

  v_amount := coalesce(
    nullif((v_order.checkout_adjustments ->> 'grandTotal')::numeric, 0),
    v_order.total_amount
  );

  select * into v_payment
  from public.order_payments
  where order_id = v_order.id;

  if not found then
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
      metadata,
      updated_at
    )
    values (
      v_order.id,
      v_order.seller_user_id,
      'upi',
      'pending',
      v_amount,
      coalesce(nullif(trim(v_order.currency_code), ''), 'INR'),
      'upi',
      v_order.customer_name,
      v_order.customer_whatsapp,
      jsonb_build_object('customer_claimed_paid_at', v_now),
      v_now
    )
    returning * into v_payment;
  elsif v_payment.status = 'paid' then
    return to_jsonb(v_payment);
  else
    update public.order_payments
    set
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('customer_claimed_paid_at', v_now),
      updated_at = v_now
    where order_id = v_order.id
    returning * into v_payment;
  end if;

  return to_jsonb(v_payment);
end;
$$;

revoke all on function public.claim_upi_payment_by_tracking_token(text) from public;
grant execute on function public.claim_upi_payment_by_tracking_token(text) to anon, authenticated;
