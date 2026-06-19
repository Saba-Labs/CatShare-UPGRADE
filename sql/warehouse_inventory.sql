-- Warehouse / inventory — same as supabase/migrations/20260614120000_warehouse_inventory.sql
-- Run once in Supabase SQL editor.

-- Warehouse / inventory rooms / variant-level stock + movement ledger

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null default 'Default warehouse',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists warehouses_one_default_per_user_idx
  on public.warehouses (user_id)
  where is_default = true;

create index if not exists warehouses_user_id_idx on public.warehouses (user_id);

create table if not exists public.inventories (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  user_id text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventories_user_id_idx on public.inventories (user_id);
create index if not exists inventories_warehouse_id_idx on public.inventories (warehouse_id);

create table if not exists public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories (id) on delete cascade,
  user_id text not null,
  product_id text not null,
  variant_combination_id text,
  on_hand numeric not null default 0 check (on_hand >= 0),
  low_stock_threshold numeric check (low_stock_threshold is null or low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_levels_unique_line_idx
  on public.inventory_levels (inventory_id, product_id, coalesce(variant_combination_id, ''));

create index if not exists inventory_levels_inventory_product_idx
  on public.inventory_levels (inventory_id, product_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  inventory_id uuid not null references public.inventories (id) on delete cascade,
  product_id text not null,
  variant_combination_id text,
  delta numeric not null,
  on_hand_after numeric not null,
  reason text not null check (reason in (
    'manual_adjust', 'transfer_in', 'transfer_out', 'order_sale', 'order_restore', 'migration'
  )),
  reference_type text check (reference_type is null or reference_type in ('order', 'transfer')),
  reference_id text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_inventory_created_idx
  on public.inventory_movements (inventory_id, created_at desc);

create index if not exists inventory_movements_user_created_idx
  on public.inventory_movements (user_id, created_at desc);

create index if not exists inventory_movements_reference_idx
  on public.inventory_movements (reference_type, reference_id)
  where reference_id is not null;

create or replace function public.current_catshare_user_id()
returns text
language sql
stable
as $$
  select coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  );
$$;

alter table public.warehouses enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists warehouses_select_own on public.warehouses;
create policy warehouses_select_own on public.warehouses
  for select using (user_id = public.current_catshare_user_id());

drop policy if exists warehouses_insert_own on public.warehouses;
create policy warehouses_insert_own on public.warehouses
  for insert with check (user_id = public.current_catshare_user_id());

drop policy if exists warehouses_update_own on public.warehouses;
create policy warehouses_update_own on public.warehouses
  for update using (user_id = public.current_catshare_user_id());

drop policy if exists warehouses_delete_own on public.warehouses;
create policy warehouses_delete_own on public.warehouses
  for delete using (user_id = public.current_catshare_user_id());

drop policy if exists inventories_select_own on public.inventories;
create policy inventories_select_own on public.inventories
  for select using (user_id = public.current_catshare_user_id());

drop policy if exists inventories_insert_own on public.inventories;
create policy inventories_insert_own on public.inventories
  for insert with check (user_id = public.current_catshare_user_id());

drop policy if exists inventories_update_own on public.inventories;
create policy inventories_update_own on public.inventories
  for update using (user_id = public.current_catshare_user_id());

drop policy if exists inventories_delete_own on public.inventories;
create policy inventories_delete_own on public.inventories
  for delete using (user_id = public.current_catshare_user_id());

drop policy if exists inventory_levels_select_own on public.inventory_levels;
create policy inventory_levels_select_own on public.inventory_levels
  for select using (user_id = public.current_catshare_user_id());

drop policy if exists inventory_levels_insert_own on public.inventory_levels;
create policy inventory_levels_insert_own on public.inventory_levels
  for insert with check (user_id = public.current_catshare_user_id());

drop policy if exists inventory_levels_update_own on public.inventory_levels;
create policy inventory_levels_update_own on public.inventory_levels
  for update using (user_id = public.current_catshare_user_id());

drop policy if exists inventory_levels_delete_own on public.inventory_levels;
create policy inventory_levels_delete_own on public.inventory_levels
  for delete using (user_id = public.current_catshare_user_id());

drop policy if exists inventory_movements_select_own on public.inventory_movements;
create policy inventory_movements_select_own on public.inventory_movements
  for select using (user_id = public.current_catshare_user_id());

drop policy if exists inventory_movements_insert_own on public.inventory_movements;
create policy inventory_movements_insert_own on public.inventory_movements
  for insert with check (user_id = public.current_catshare_user_id());

create or replace function public.resolve_catalogue_inventory_id(
  p_seller_id text,
  p_catalogue_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_def jsonb;
  v_cat jsonb;
  v_inv text;
begin
  if p_seller_id is null or p_catalogue_id is null then
    return null;
  end if;

  select cd.data into v_def
  from public.catalogues_definition cd
  where cd.user_id::text = trim(p_seller_id)
  order by cd.updated_at desc nulls last
  limit 1;

  if v_def is null then
    return null;
  end if;

  select elem into v_cat
  from jsonb_array_elements(coalesce(v_def -> 'catalogues', '[]'::jsonb)) elem
  where elem ->> 'id' = trim(p_catalogue_id)
  limit 1;

  if v_cat is null then
    return null;
  end if;

  v_inv := nullif(trim(v_cat ->> 'inventoryId'), '');
  if v_inv is not null then
    return v_inv::uuid;
  end if;

  select coalesce(u.data, '{}'::jsonb) into v_def
  from public.user_settings u
  where u.user_id::text = trim(p_seller_id)
  limit 1;

  if v_def is not null then
    select elem into v_cat
    from jsonb_array_elements(coalesce(v_def -> 'cataloguesDefinition' -> 'catalogues', '[]'::jsonb)) elem
    where elem ->> 'id' = trim(p_catalogue_id)
    limit 1;

    if v_cat is not null then
      v_inv := nullif(trim(v_cat ->> 'inventoryId'), '');
      if v_inv is not null then
        return v_inv::uuid;
      end if;
    end if;
  end if;

  return null;
exception
  when others then
    return null;
end;
$$;

create or replace function public.ensure_default_warehouse(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wh public.warehouses%rowtype;
  v_inv public.inventories%rowtype;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'user_id_required';
  end if;

  select * into v_wh
  from public.warehouses
  where user_id = trim(p_user_id) and is_default = true
  limit 1;

  if not found then
    insert into public.warehouses (user_id, name, is_default)
    values (trim(p_user_id), 'Default warehouse', true)
    returning * into v_wh;
  end if;

  select * into v_inv
  from public.inventories
  where warehouse_id = v_wh.id and name = 'Main'
  order by sort_order asc, created_at asc
  limit 1;

  if not found then
    insert into public.inventories (warehouse_id, user_id, name, sort_order)
    values (v_wh.id, trim(p_user_id), 'Main', 0)
    returning * into v_inv;
  end if;

  return jsonb_build_object(
    'warehouseId', v_wh.id,
    'warehouseName', v_wh.name,
    'mainInventoryId', v_inv.id,
    'mainInventoryName', v_inv.name
  );
end;
$$;

create or replace function public.get_storefront_inventory(
  p_seller_id text,
  p_catalogue_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inventory_id uuid;
  v_lines jsonb;
begin
  v_inventory_id := public.resolve_catalogue_inventory_id(p_seller_id, p_catalogue_id);

  v_lines := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'productId', il.product_id,
          'variantCombinationId', il.variant_combination_id,
          'onHand', il.on_hand,
          'lowStockThreshold', il.low_stock_threshold
        )
      )
      from public.inventory_levels il
      where il.inventory_id = v_inventory_id
    ),
    '[]'::jsonb
  );

  return jsonb_build_object(
    'inventoryId', v_inventory_id,
    'lines', v_lines
  );
end;
$$;

create or replace function public.adjust_inventory_level(
  p_inventory_id uuid,
  p_product_id text,
  p_variant_combination_id text,
  p_new_on_hand numeric,
  p_low_stock_threshold numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text;
  v_inv public.inventories%rowtype;
  v_old numeric := 0;
  v_delta numeric;
  v_level public.inventory_levels%rowtype;
  v_variant text;
begin
  v_user := public.current_catshare_user_id();
  if v_user is null or length(v_user) = 0 then
    raise exception 'unauthorized';
  end if;

  if p_new_on_hand < 0 then
    raise exception 'invalid_on_hand';
  end if;

  select * into v_inv
  from public.inventories
  where id = p_inventory_id and user_id = v_user;

  if not found then
    raise exception 'inventory_not_found';
  end if;

  v_variant := nullif(trim(p_variant_combination_id), '');

  select * into v_level
  from public.inventory_levels
  where inventory_id = p_inventory_id
    and product_id = trim(p_product_id)
    and coalesce(variant_combination_id, '') = coalesce(v_variant, '');

  if found then
    v_old := v_level.on_hand;
    v_delta := p_new_on_hand - v_old;

    update public.inventory_levels
    set
      on_hand = p_new_on_hand,
      low_stock_threshold = p_low_stock_threshold,
      updated_at = now()
    where id = v_level.id
    returning * into v_level;
  else
    v_delta := p_new_on_hand;
    insert into public.inventory_levels (
      inventory_id, user_id, product_id, variant_combination_id, on_hand, low_stock_threshold
    )
    values (
      p_inventory_id, v_user, trim(p_product_id), v_variant, p_new_on_hand, p_low_stock_threshold
    )
    returning * into v_level;
  end if;

  if v_delta <> 0 then
    insert into public.inventory_movements (
      user_id, inventory_id, product_id, variant_combination_id,
      delta, on_hand_after, reason, note
    )
    values (
      v_user, p_inventory_id, trim(p_product_id), v_variant,
      v_delta, v_level.on_hand, 'manual_adjust', nullif(trim(p_note), '')
    );
  end if;

  return jsonb_build_object(
    'id', v_level.id,
    'inventoryId', v_level.inventory_id,
    'productId', v_level.product_id,
    'variantCombinationId', v_level.variant_combination_id,
    'onHand', v_level.on_hand,
    'lowStockThreshold', v_level.low_stock_threshold
  );
end;
$$;

create or replace function public.transfer_inventory(
  p_from_inventory_id uuid,
  p_to_inventory_id uuid,
  p_product_id text,
  p_variant_combination_id text,
  p_qty numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text;
  v_from public.inventories%rowtype;
  v_to public.inventories%rowtype;
  v_variant text;
  v_from_level public.inventory_levels%rowtype;
  v_to_after numeric;
  v_transfer_id text;
begin
  v_user := public.current_catshare_user_id();
  if v_user is null or length(v_user) = 0 then
    raise exception 'unauthorized';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid_qty';
  end if;

  if p_from_inventory_id = p_to_inventory_id then
    raise exception 'same_inventory';
  end if;

  select * into v_from from public.inventories where id = p_from_inventory_id and user_id = v_user;
  if not found then raise exception 'from_inventory_not_found'; end if;

  select * into v_to from public.inventories where id = p_to_inventory_id and user_id = v_user;
  if not found then raise exception 'to_inventory_not_found'; end if;

  v_variant := nullif(trim(p_variant_combination_id), '');
  v_transfer_id := gen_random_uuid()::text;

  select * into v_from_level
  from public.inventory_levels
  where inventory_id = p_from_inventory_id
    and product_id = trim(p_product_id)
    and coalesce(variant_combination_id, '') = coalesce(v_variant, '');

  if not found or v_from_level.on_hand < p_qty then
    raise exception 'insufficient_stock';
  end if;

  update public.inventory_levels
  set on_hand = v_from_level.on_hand - p_qty, updated_at = now()
  where id = v_from_level.id;

  insert into public.inventory_movements (
    user_id, inventory_id, product_id, variant_combination_id,
    delta, on_hand_after, reason, reference_type, reference_id, note
  )
  values (
    v_user, p_from_inventory_id, trim(p_product_id), v_variant,
    -p_qty, v_from_level.on_hand - p_qty, 'transfer_out', 'transfer', v_transfer_id, nullif(trim(p_note), '')
  );

  select on_hand into v_to_after
  from public.inventory_levels
  where inventory_id = p_to_inventory_id
    and product_id = trim(p_product_id)
    and coalesce(variant_combination_id, '') = coalesce(v_variant, '');

  if found then
    v_to_after := v_to_after + p_qty;
    update public.inventory_levels
    set on_hand = v_to_after, updated_at = now()
    where inventory_id = p_to_inventory_id
      and product_id = trim(p_product_id)
      and coalesce(variant_combination_id, '') = coalesce(v_variant, '');
  else
    v_to_after := p_qty;
    insert into public.inventory_levels (
      inventory_id, user_id, product_id, variant_combination_id, on_hand
    )
    values (
      p_to_inventory_id, v_user, trim(p_product_id), v_variant, p_qty
    );
  end if;

  insert into public.inventory_movements (
    user_id, inventory_id, product_id, variant_combination_id,
    delta, on_hand_after, reason, reference_type, reference_id, note
  )
  values (
    v_user, p_to_inventory_id, trim(p_product_id), v_variant,
    p_qty, v_to_after, 'transfer_in', 'transfer', v_transfer_id, nullif(trim(p_note), '')
  );

  return jsonb_build_object('transferId', v_transfer_id, 'qty', p_qty);
end;
$$;

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
    where s.seller_user_id::text = trim(v_order.seller_user_id)
    order by s.created_at asc
    limit 1;
  end if;

  if v_catalogue_id is null then
    return jsonb_build_object('applied', false, 'reason', 'no_catalogue');
  end if;

  v_inventory_id := public.resolve_catalogue_inventory_id(v_order.seller_user_id, v_catalogue_id);
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
      v_order.seller_user_id, v_inventory_id, v_product_id, v_variant,
      -v_qty, v_new_on_hand, 'order_sale', 'order', p_order_id
    );
  end loop;

  return jsonb_build_object('applied', true);
end;
$$;

create or replace function public.restore_order_inventory(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_mov public.inventory_movements%rowtype;
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
  where reference_type = 'order' and reference_id = p_order_id and reason = 'order_restore';

  if v_existing > 0 then
    return jsonb_build_object('restored', true, 'skipped', true);
  end if;

  for v_mov in
    select * from public.inventory_movements
    where reference_type = 'order' and reference_id = p_order_id and reason = 'order_sale'
    order by created_at asc
  loop
    select * into v_level
    from public.inventory_levels
    where inventory_id = v_mov.inventory_id
      and product_id = v_mov.product_id
      and coalesce(variant_combination_id, '') = coalesce(v_mov.variant_combination_id, '');

    if found then
      v_new_on_hand := v_level.on_hand + abs(v_mov.delta);
      update public.inventory_levels
      set on_hand = v_new_on_hand, updated_at = now()
      where id = v_level.id;
    else
      v_new_on_hand := abs(v_mov.delta);
      insert into public.inventory_levels (
        inventory_id, user_id, product_id, variant_combination_id, on_hand
      )
      values (
        v_mov.inventory_id, v_order.seller_user_id, v_mov.product_id,
        v_mov.variant_combination_id, v_new_on_hand
      );
    end if;

    insert into public.inventory_movements (
      user_id, inventory_id, product_id, variant_combination_id,
      delta, on_hand_after, reason, reference_type, reference_id
    )
    values (
      v_order.seller_user_id, v_mov.inventory_id, v_mov.product_id, v_mov.variant_combination_id,
      abs(v_mov.delta), v_new_on_hand, 'order_restore', 'order', p_order_id
    );
  end loop;

  return jsonb_build_object('restored', true);
end;
$$;

revoke all on function public.ensure_default_warehouse(text) from public;
grant execute on function public.ensure_default_warehouse(text) to anon, authenticated;

revoke all on function public.get_storefront_inventory(text, text) from public;
grant execute on function public.get_storefront_inventory(text, text) to anon, authenticated;

revoke all on function public.adjust_inventory_level(uuid, text, text, numeric, numeric, text) from public;
grant execute on function public.adjust_inventory_level(uuid, text, text, numeric, numeric, text) to anon, authenticated;

revoke all on function public.transfer_inventory(uuid, uuid, text, text, numeric, text) from public;
grant execute on function public.transfer_inventory(uuid, uuid, text, text, numeric, text) to anon, authenticated;

revoke all on function public.apply_order_inventory(text) from public;
grant execute on function public.apply_order_inventory(text) to anon, authenticated;

revoke all on function public.restore_order_inventory(text) from public;
grant execute on function public.restore_order_inventory(text) to anon, authenticated;
