-- Skip inventory deduction for SKUs with no stock row (untracked) instead of failing the order.
create or replace function public.apply_order_inventory(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_catalogue_id text;
  v_inventory_id uuid;
  v_item jsonb;
  v_product_id text;
  v_variant text;
  v_qty numeric;
  v_level public.inventory_levels%rowtype;
  v_new_on_hand numeric;
  v_existing int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  select count(*) into v_existing
  from public.inventory_movements
  where reference_type = 'order' and reference_id = p_order_id and reason = 'order_sale';

  if v_existing > 0 then
    return jsonb_build_object('applied', true, 'skipped', true);
  end if;

  if v_order.store_slug is not null and length(trim(v_order.store_slug)) > 0 then
    select s.catalogue_id into v_catalogue_id
    from public.stores s
    where lower(s.store_slug) = lower(trim(v_order.store_slug))
    limit 1;
  end if;

  if v_catalogue_id is null then
    select s.catalogue_id into v_catalogue_id
    from public.stores s
    where s.seller_user_id::text = trim(v_order.seller_user_id::text)
    order by s.created_at asc
    limit 1;
  end if;

  if v_catalogue_id is null then
    return jsonb_build_object('applied', false, 'reason', 'no_catalogue');
  end if;

  v_inventory_id := public.resolve_catalogue_inventory_id(v_order.seller_user_id::text, v_catalogue_id);
  if v_inventory_id is null then
    return jsonb_build_object('applied', false, 'reason', 'no_inventory_link');
  end if;

  for v_item in select * from jsonb_array_elements(v_order.items)
  loop
    v_product_id := trim(coalesce(v_item ->> 'productId', ''));
    v_variant := nullif(trim(coalesce(v_item ->> 'variantCombinationId', '')), '');
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);

    if v_product_id = '' or v_qty <= 0 then
      continue;
    end if;

    select * into v_level
    from public.inventory_levels
    where inventory_id = v_inventory_id
      and product_id = v_product_id
      and coalesce(variant_combination_id, '') = coalesce(v_variant, '');

    if not found then
      continue;
    end if;

    if v_level.on_hand < v_qty then
      raise exception 'insufficient_stock';
    end if;

    v_new_on_hand := v_level.on_hand - v_qty;

    update public.inventory_levels
    set on_hand = v_new_on_hand, updated_at = now()
    where id = v_level.id;

    insert into public.inventory_movements (
      user_id, inventory_id, product_id, variant_combination_id,
      delta, on_hand_after, reason, reference_type, reference_id
    )
    values (
      v_order.seller_user_id::text, v_inventory_id, v_product_id, v_variant,
      -v_qty, v_new_on_hand, 'order_sale', 'order', p_order_id
    );
  end loop;

  return jsonb_build_object('applied', true);
end;
$$;

revoke all on function public.apply_order_inventory(text) from public;
grant execute on function public.apply_order_inventory(text) to anon, authenticated;
