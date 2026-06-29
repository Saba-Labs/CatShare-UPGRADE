-- Link UPI payment status to tracking page + mark customer claim as paid.

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
      paid_at,
      metadata,
      updated_at
    )
    values (
      v_order.id,
      v_order.seller_user_id,
      'upi',
      'paid',
      v_amount,
      coalesce(nullif(trim(v_order.currency_code), ''), 'INR'),
      'upi',
      v_order.customer_name,
      v_order.customer_whatsapp,
      v_now,
      jsonb_build_object(
        'customer_claimed_paid_at', v_now,
        'payment_confirmed_by', 'customer'
      ),
      v_now
    )
    returning * into v_payment;
  elsif v_payment.status = 'paid' then
    return to_jsonb(v_payment);
  else
    update public.order_payments
    set
      status = 'paid',
      paid_at = v_now,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'customer_claimed_paid_at', v_now,
        'payment_confirmed_by', 'customer'
      ),
      updated_at = v_now
    where order_id = v_order.id
    returning * into v_payment;
  end if;

  return to_jsonb(v_payment);
end;
$$;

create or replace function public.get_order_by_tracking_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.order_payments%rowtype;
  v_result jsonb;
  v_payment_status text;
  v_upi_vpa text;
  v_store_label text;
  v_amount numeric;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;

  select * into v_order
  from public.orders
  where tracking_token = trim(p_token)
  limit 1;

  if not found then
    return null;
  end if;

  v_result := to_jsonb(v_order);
  v_amount := coalesce(
    nullif((v_order.checkout_adjustments ->> 'grandTotal')::numeric, 0),
    v_order.total_amount
  );

  begin
    select * into v_payment
    from public.order_payments
    where order_id = v_order.id
    order by created_at desc
    limit 1;

    if found then
      v_payment_status := v_payment.status;
      v_result := v_result || jsonb_build_object(
        'payment_summary',
        jsonb_build_object(
          'status', v_payment.status,
          'method', coalesce(v_payment.payment_method, v_order.payment_method),
          'provider', v_payment.provider,
          'paid_at', v_payment.paid_at,
          'customer_claimed_paid_at', v_payment.metadata ->> 'customer_claimed_paid_at',
          'payment_confirmed_by', v_payment.metadata ->> 'payment_confirmed_by'
        )
      );
    elsif coalesce(v_order.payment_method, '') <> '' then
      v_payment_status := 'pending';
      v_result := v_result || jsonb_build_object(
        'payment_summary',
        jsonb_build_object(
          'status', 'pending',
          'method', v_order.payment_method,
          'provider', null,
          'paid_at', null,
          'customer_claimed_paid_at', null,
          'payment_confirmed_by', null
        )
      );
    end if;
  exception
    when undefined_table then
      v_payment_status := case
        when coalesce(v_order.payment_method, '') <> '' then 'pending'
        else null
      end;
  end;

  if coalesce(v_order.payment_method, '') = 'upi'
     and coalesce(v_payment_status, 'pending') <> 'paid' then
    begin
      select
        nullif(trim(coalesce(s.checkout_settings ->> 'sellerUpiId', '')), ''),
        coalesce(nullif(trim(s.store_slug), ''), 'Store')
      into v_upi_vpa, v_store_label
      from public.stores s
      where s.seller_user_id = v_order.seller_user_id
        and (
          v_order.store_slug is null
          or length(trim(v_order.store_slug)) = 0
          or lower(s.store_slug) = lower(trim(v_order.store_slug))
        )
      order by s.updated_at desc nulls last
      limit 1;

      if v_upi_vpa is not null then
        v_result := v_result || jsonb_build_object(
          'upi_checkout',
          jsonb_build_object(
            'vpa', lower(v_upi_vpa),
            'amount', v_amount,
            'order_ref', upper(left(v_order.id::text, 8)),
            'store_name', v_store_label
          )
        );
      end if;
    exception
      when undefined_column then
        null;
    end;
  end if;

  return v_result;
end;
$$;

create or replace function public.get_order_tracking_payment_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full jsonb;
begin
  v_full := public.get_order_by_tracking_token(p_token);
  if v_full is null then
    return null;
  end if;

  return jsonb_build_object(
    'payment_summary', v_full -> 'payment_summary',
    'upi_checkout', v_full -> 'upi_checkout'
  );
end;
$$;

revoke all on function public.get_order_tracking_payment_context(text) from public;
grant execute on function public.get_order_tracking_payment_context(text) to anon, authenticated;
