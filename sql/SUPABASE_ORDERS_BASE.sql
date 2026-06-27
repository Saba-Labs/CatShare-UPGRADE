-- Step 1: Orders table + RLS (skip if you already have public.orders)
-- Source: SUPABASE_ORDERS_SQL.md

create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  share_link_token text not null,
  seller_user_id text not null,
  customer_name text not null,
  customer_whatsapp text,
  items jsonb not null,
  total_amount numeric,
  currency_code text default 'INR',
  status text default 'pending',
  order_source text,
  tracking_token text,
  store_slug text,
  customer_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_seller_user_id_idx on public.orders (seller_user_id);
create index if not exists orders_share_link_token_idx on public.orders (share_link_token);
create index if not exists orders_seller_created_idx on public.orders (seller_user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

drop policy if exists "seller_select_own_orders" on public.orders;
create policy "seller_select_own_orders" on public.orders for select using (
  seller_user_id::text = coalesce((current_setting('request.headers', true)::json->>'x-user-id'), '')
);

drop policy if exists "seller_insert_own_orders" on public.orders;
create policy "seller_insert_own_orders" on public.orders for insert with check (
  seller_user_id::text = coalesce((current_setting('request.headers', true)::json->>'x-user-id'), '')
);

drop policy if exists "seller_update_own_orders" on public.orders;
create policy "seller_update_own_orders" on public.orders for update using (
  seller_user_id::text = coalesce((current_setting('request.headers', true)::json->>'x-user-id'), '')
);

drop policy if exists "seller_select_own_orders_via_auth" on public.orders;
create policy "seller_select_own_orders_via_auth" on public.orders for select to authenticated
using (seller_user_id::text = (auth.uid())::text);

-- Realtime (optional): alter publication supabase_realtime add table public.orders;
