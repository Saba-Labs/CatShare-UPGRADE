-- Keep checkout_adjustments totals aligned when customers edit quantities via tracking link.

create or replace function public.update_order_by_tracking_token(
  p_token text,
  p_customer_name text,
  p_customer_whatsapp text,
  p_items jsonb,
  p_total_amount numeric,
  p_status text default null,
  p_order_note text default null,
  p_gift_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_status text;
  v_name text;
  v_order_note text;
  v_gift_message text;
  v_checkout jsonb;
  v_notes jsonb;
  v_old_sub numeric;
  v_old_grand numeric;
  v_adj_delta numeric;
  v_new_sub numeric;
  v_new_grand numeric;
  v_total_amount numeric;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'invalid_token';
  end if;

  select * into v_order
  from public.orders
  where tracking_token = trim(p_token)
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status in ('completed', 'processing', 'shipped') then
    raise exception 'order_locked';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), v_order.status);
  if v_status not in ('pending', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  v_name := nullif(trim(coalesce(p_customer_name, '')), '');
  if v_status = 'pending' and v_name is null then
    raise exception 'customer_name_required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_items';
  end if;

  if v_status = 'pending' and jsonb_array_length(p_items) = 0 then
    raise exception 'items_required';
  end if;

  v_checkout := coalesce(v_order.checkout_adjustments, '{}'::jsonb);
  if jsonb_typeof(v_checkout) <> 'object' then
    v_checkout := '{}'::jsonb;
  end if;

  if p_order_note is not null or p_gift_message is not null then
    v_notes := coalesce(v_checkout -> 'customerNotes', '{}'::jsonb);
    if jsonb_typeof(v_notes) <> 'object' then
      v_notes := '{}'::jsonb;
    end if;

    if p_order_note is not null then
      v_order_note := nullif(trim(p_order_note), '');
      v_notes := v_notes || jsonb_build_object('orderNote', to_jsonb(v_order_note));
    else
      v_order_note := nullif(
        trim(coalesce(v_notes ->> 'orderNote', v_order.customer_notes, '')),
        ''
      );
    end if;

    if p_gift_message is not null then
      v_gift_message := nullif(trim(p_gift_message), '');
      v_notes := v_notes || jsonb_build_object('giftMessage', to_jsonb(v_gift_message));
    end if;

    v_checkout := jsonb_set(v_checkout, '{customerNotes}', v_notes);
  end if;

  if p_total_amount is not null and v_status = 'pending' then
    v_total_amount := p_total_amount;
    v_old_sub := coalesce(
      nullif(v_checkout ->> 'subtotal', '')::numeric,
      v_order.total_amount,
      v_total_amount
    );
    v_old_grand := coalesce(
      nullif(v_checkout ->> 'grandTotal', '')::numeric,
      v_order.total_amount,
      v_total_amount
    );
    v_adj_delta := v_old_grand - v_old_sub;
    v_new_sub := v_total_amount;
    v_new_grand := greatest(0, v_new_sub + v_adj_delta);

    if v_checkout ? 'subtotal' or v_checkout ? 'grandTotal' then
      v_checkout := jsonb_set(
        jsonb_set(v_checkout, '{subtotal}', to_jsonb(v_new_sub)),
        '{grandTotal}',
        to_jsonb(v_new_grand)
      );
      v_total_amount := v_new_grand;
    end if;
  else
    v_total_amount := p_total_amount;
  end if;

  update public.orders
  set
    customer_name = coalesce(v_name, v_order.customer_name),
    customer_whatsapp = nullif(trim(coalesce(p_customer_whatsapp, '')), ''),
    customer_notes = case
      when p_order_note is not null then v_order_note
      else v_order.customer_notes
    end,
    checkout_adjustments = case
      when p_order_note is not null
        or p_gift_message is not null
        or (p_total_amount is not null and (v_checkout ? 'subtotal' or v_checkout ? 'grandTotal'))
        then v_checkout
      else v_order.checkout_adjustments
    end,
    items = p_items,
    total_amount = v_total_amount,
    status = v_status,
    customer_edited_at = now(),
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.update_order_by_tracking_token(text, text, text, jsonb, numeric, text, text, text) from public;
grant execute on function public.update_order_by_tracking_token(text, text, text, jsonb, numeric, text, text, text) to anon, authenticated;
