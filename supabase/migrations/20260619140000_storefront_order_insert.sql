-- Allow anonymous storefront customers to place orders (order_source = 'store').
-- Seller-scoped inserts via x-user-id remain for share links / seller tools.

drop policy if exists public_insert_store_orders on public.orders;

create policy public_insert_store_orders
on public.orders
for insert
to anon, authenticated
with check (
  order_source = 'store'
  and seller_user_id is not null
  and length(trim(seller_user_id::text)) > 0
  and exists (
    select 1
    from public.stores s
    where s.seller_user_id::text = trim(orders.seller_user_id::text)
      and coalesce(s.is_live, true) = true
  )
);

-- Security definer fallback when RLS/header paths fail (optional columns added when present).
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
      nullif(trim(coalesce(p_payment_method, '')), ''),
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

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_storefront_order(
  text, text, text, text, text, jsonb, numeric, text, text, text, jsonb, jsonb
) from public;

grant execute on function public.create_storefront_order(
  text, text, text, text, text, jsonb, numeric, text, text, text, jsonb, jsonb
) to anon, authenticated;
