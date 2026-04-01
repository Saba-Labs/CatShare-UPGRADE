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
  status text default 'pending' check (status in ('pending', 'completed', 'cancelled')),
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

### Troubleshooting

1. **`x-user-id` and RLS** — The policies expect the browser to send `x-user-id` matching `seller_user_id`. The CatShare web app sets this header on every Supabase request when signed in.

2. **Order creation** — Orders are created when a customer confirms their selection in the order form and sends WhatsApp message. The app should save the order to this table at that point.
