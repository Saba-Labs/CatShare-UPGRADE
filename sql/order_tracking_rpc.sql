-- Customer order tracking via secret link (no Supabase Auth / no MAU).
-- Same as supabase/migrations/20260612120000_order_tracking_token.sql

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled'));

alter table public.orders
  add column if not exists tracking_token text,
  add column if not exists store_slug text,
  add column if not exists customer_edited_at timestamptz;

create unique index if not exists orders_tracking_token_uidx
  on public.orders (tracking_token)
  where tracking_token is not null;

create index if not exists orders_store_slug_idx
  on public.orders (store_slug)
  where store_slug is not null;

create or replace function public.get_order_by_tracking_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
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

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.get_order_by_tracking_token(text) from public;
grant execute on function public.get_order_by_tracking_token(text) to anon, authenticated;

create or replace function public.update_order_by_tracking_token(
  p_token text,
  p_customer_name text,
  p_customer_whatsapp text,
  p_items jsonb,
  p_total_amount numeric,
  p_status text default null
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

  if v_order.status in ('completed', 'confirmed') then
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

  update public.orders
  set
    customer_name = coalesce(v_name, v_order.customer_name),
    customer_whatsapp = nullif(trim(coalesce(p_customer_whatsapp, '')), ''),
    items = p_items,
    total_amount = p_total_amount,
    status = v_status,
    customer_edited_at = now(),
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.update_order_by_tracking_token(text, text, text, jsonb, numeric, text) from public;
grant execute on function public.update_order_by_tracking_token(text, text, text, jsonb, numeric, text) to anon, authenticated;
