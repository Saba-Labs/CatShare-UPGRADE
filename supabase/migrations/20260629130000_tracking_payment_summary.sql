-- Include payment summary on public order tracking reads.

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

  begin
    select * into v_payment
    from public.order_payments
    where order_id = v_order.id
    order by created_at desc
    limit 1;

    if found then
      v_result := v_result || jsonb_build_object(
        'payment_summary',
        jsonb_build_object(
          'status', v_payment.status,
          'method', coalesce(v_payment.payment_method, v_order.payment_method),
          'provider', v_payment.provider,
          'paid_at', v_payment.paid_at,
          'customer_claimed_paid_at', v_payment.metadata ->> 'customer_claimed_paid_at'
        )
      );
    elsif coalesce(v_order.payment_method, '') <> '' then
      v_result := v_result || jsonb_build_object(
        'payment_summary',
        jsonb_build_object(
          'status', 'pending',
          'method', v_order.payment_method,
          'provider', null,
          'paid_at', null,
          'customer_claimed_paid_at', null
        )
      );
    end if;
  exception
    when undefined_table then
      null;
  end;

  return v_result;
end;
$$;
