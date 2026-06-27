## Supabase SQL for Customer Orders

Run this in the Supabase SQL editor to store customer orders from order forms.

### 1) Orders Table

```sql
create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  share_link_token text not null,
  seller_user_id text not null,
  customer_name text not null,
  customer_whatsapp text,
  items jsonb not null,
  total_amount numeric,
  currency_code text default 'INR',
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  order_source text,
  tracking_token text,
  store_slug text,
  customer_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists orders_seller_user_id_idx
  on public.orders (seller_user_id);

create index if not exists orders_share_link_token_idx
  on public.orders (share_link_token);

create index if not exists orders_seller_created_idx
  on public.orders (seller_user_id, created_at desc);

create index if not exists orders_status_idx
  on public.orders (status);
```

### 2) RLS (Seller can only see their own orders)

```sql
alter table public.orders enable row level security;

-- Seller can read only their own orders
create policy "seller_select_own_orders"
on public.orders
for select
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can insert orders for themselves
create policy "seller_insert_own_orders"
on public.orders
for insert
with check (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can update status of their own orders
create policy "seller_update_own_orders"
on public.orders
for update
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);
```

### 3) Sample Order Items Structure

When saving an order, the `items` jsonb should contain:

```json
[
  {
    "productId": "product-123",
    "name": "Product Name",
    "quantity": 2,
    "unitPrice": 500,
    "rowTotal": 1000,
    "category": "Category Name"
  },
  {
    "productId": "product-456",
    "name": "Another Product",
    "quantity": 1,
    "unitPrice": 750,
    "rowTotal": 750,
    "category": "Category Name"
  }
]
```

### 4) Realtime (new-order notifications for sellers)

The app subscribes to `INSERT` on `orders` while the seller is signed in. Enable the table for Realtime and allow `SELECT` via the signed-in user’s JWT (Realtime does not use the `x-user-id` header the same way as REST).

```sql
-- Expose orders to Supabase Realtime (run once)
alter publication supabase_realtime add table public.orders;

-- Sellers can read their own rows when authenticated (JWT), for Realtime + REST
create policy "seller_select_own_orders_via_auth"
on public.orders
for select
to authenticated
using (seller_user_id::text = (auth.uid())::text);
```

Keep the existing `seller_select_own_orders` policy that uses `x-user-id` for REST clients that rely on that header. Postgres combines multiple `SELECT` policies with **OR**, so both can apply.

### 5) Customer order tracking (secret link, no login)

Run `sql/order_tracking_rpc.sql` (or migration `20260612120000_order_tracking_token.sql`).

- Each new order gets a random `tracking_token` (64-char hex).
- Store orders also store `store_slug` so customers can add products from the live storefront catalogue when editing.
- Public URL: `https://your-domain/track/{tracking_token}`
- RPCs (security definer, granted to `anon`):
  - `get_order_by_tracking_token(p_token)` — read order
  - `update_order_by_tracking_token(...)` — full edit while `status = pending`; customer may set `cancelled`

No Supabase Auth user is created, so this does **not** increase MAU.

### Troubleshooting

1. **`x-user-id` and RLS** — The policies expect the browser to send `x-user-id` matching `seller_user_id`. The CatShare web app sets this header on every Supabase request when signed in.

2. **Order creation** — Orders are created when a customer confirms their selection in the order form and sends WhatsApp message. The app should save the order to this table at that point.

3. **No realtime events** — In the Supabase dashboard, confirm **Database → Replication** includes `orders`, and that the `seller_select_own_orders_via_auth` policy exists so the subscribed user can read new rows.
