-- Seller integrations, order payments/shipments, shipping preferences

create table if not exists public.seller_integrations (
  id uuid primary key default gen_random_uuid(),
  seller_user_id text not null,
  provider text not null,
  category text not null,
  status text not null default 'not_connected',
  account_id text,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seller_integrations_seller_provider_idx
  on public.seller_integrations (seller_user_id, provider);

create index if not exists seller_integrations_seller_id_idx
  on public.seller_integrations (seller_user_id);

alter table public.seller_integrations enable row level security;

drop policy if exists seller_integrations_select_own on public.seller_integrations;
create policy seller_integrations_select_own on public.seller_integrations
  for select using (seller_user_id = public.current_catshare_user_id());

drop policy if exists seller_integrations_insert_own on public.seller_integrations;
create policy seller_integrations_insert_own on public.seller_integrations
  for insert with check (seller_user_id = public.current_catshare_user_id());

drop policy if exists seller_integrations_update_own on public.seller_integrations;
create policy seller_integrations_update_own on public.seller_integrations
  for update using (seller_user_id = public.current_catshare_user_id());

drop policy if exists seller_integrations_delete_own on public.seller_integrations;
create policy seller_integrations_delete_own on public.seller_integrations
  for delete using (seller_user_id = public.current_catshare_user_id());

-- Order payments (gateway transactions)
-- order_id type must match public.orders.id (uuid in most deployed DBs; see SUPABASE_ORDERS_SQL.md for text).
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seller_user_id text not null,
  provider text not null,
  status text not null default 'pending',
  payment_id text,
  provider_order_id text,
  amount numeric,
  currency text not null default 'INR',
  payment_method text,
  customer_name text,
  customer_email text,
  customer_phone text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_payments_order_id_idx on public.order_payments (order_id);
create index if not exists order_payments_seller_id_idx on public.order_payments (seller_user_id);

alter table public.order_payments enable row level security;

drop policy if exists order_payments_select_own on public.order_payments;
create policy order_payments_select_own on public.order_payments
  for select using (seller_user_id = public.current_catshare_user_id());

drop policy if exists order_payments_insert_own on public.order_payments;
create policy order_payments_insert_own on public.order_payments
  for insert with check (seller_user_id = public.current_catshare_user_id());

drop policy if exists order_payments_update_own on public.order_payments;
create policy order_payments_update_own on public.order_payments
  for update using (seller_user_id = public.current_catshare_user_id());

drop policy if exists order_payments_delete_own on public.order_payments;
create policy order_payments_delete_own on public.order_payments
  for delete using (seller_user_id = public.current_catshare_user_id());

-- Order shipments (fulfillment tracking)
create table if not exists public.order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seller_user_id text not null,
  provider text not null,
  shipment_id text,
  awb_number text,
  courier text,
  tracking_number text,
  tracking_url text,
  pickup_date date,
  estimated_delivery date,
  delivery_status text not null default 'unknown',
  timeline jsonb not null default '[]'::jsonb,
  last_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_shipments_order_id_idx on public.order_shipments (order_id);
create index if not exists order_shipments_seller_id_idx on public.order_shipments (seller_user_id);

alter table public.order_shipments enable row level security;

drop policy if exists order_shipments_select_own on public.order_shipments;
create policy order_shipments_select_own on public.order_shipments
  for select using (seller_user_id = public.current_catshare_user_id());

drop policy if exists order_shipments_insert_own on public.order_shipments;
create policy order_shipments_insert_own on public.order_shipments
  for insert with check (seller_user_id = public.current_catshare_user_id());

drop policy if exists order_shipments_update_own on public.order_shipments;
create policy order_shipments_update_own on public.order_shipments
  for update using (seller_user_id = public.current_catshare_user_id());

drop policy if exists order_shipments_delete_own on public.order_shipments;
create policy order_shipments_delete_own on public.order_shipments
  for delete using (seller_user_id = public.current_catshare_user_id());

-- Shipping preferences on store (integration fulfillment settings)
alter table public.stores
  add column if not exists shipping_preferences jsonb not null default '{"mode":"actual"}'::jsonb;
