## Supabase SQL for Persistent Stores

Run this in the Supabase SQL editor to create the stores table and associated functions.

### 1) Stores Table

```sql
create table if not exists public.stores (
  id text primary key default gen_random_uuid()::text,
  seller_user_id text not null unique,  -- One store per seller
  store_slug text not null unique,      -- URL identifier (e.g., "refresh")
  catalogue_id text not null,           -- Foreign key to selected catalogue
  is_live boolean not null default true, -- Public storefront on/off (seller toggle)
  store_whatsapp text, -- Optional WhatsApp for public storefront (international format)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists stores_seller_user_id_idx
  on public.stores (seller_user_id);

create index if not exists stores_store_slug_idx
  on public.stores (store_slug);
```

**Migration (existing databases):** live / offline toggle and optional storefront WhatsApp.

```sql
alter table public.stores
  add column if not exists is_live boolean not null default true;

alter table public.stores
  add column if not exists store_whatsapp text;
```

### 2) RLS Policies (Seller can manage their own store, public can read via slug)

```sql
alter table public.stores enable row level security;

-- Seller can read only their own store
create policy "seller_select_own_store"
on public.stores
for select
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can insert only for themselves (one store per seller enforced by UNIQUE constraint)
create policy "seller_insert_own_store"
on public.stores
for insert
with check (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can update only their own store
create policy "seller_update_own_store"
on public.stores
for update
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
)
with check (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can delete only their own store
create policy "seller_delete_own_store"
on public.stores
for delete
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Public can read any store via slug (for public store views)
create policy "public_select_by_slug"
on public.stores
for select
using (true);
```

### 3) Public RPC to Get Store by Slug

This RPC is called by unauthenticated users to view a store. It merges live seller data from `user_settings` (currency, logo, and business profile fields for the public store header).

If you already deployed an older version, run the `create or replace function` block below again so the response includes `sellerBusinessName`, `sellerAbout`, contact fields, etc.

```sql
create or replace function public.get_store_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  us_currency text;
  us_data jsonb;
  eff_currency text;
  eff_logo text;
  bp jsonb;
begin
  select
    s.id,
    s.seller_user_id,
    s.store_slug,
    s.catalogue_id,
    s.created_at,
    coalesce(s.is_live, true) as is_live,
    s.store_whatsapp
  into rec
  from public.stores s
  where s.store_slug = p_slug
  limit 1;

  if rec is null then
    return null;
  end if;

  -- Fetch seller's current settings (currency + JSON data for business profile)
  select u.currency, coalesce(u.data, '{}'::jsonb)
  into us_currency, us_data
  from public.user_settings u
  where u.user_id = rec.seller_user_id::uuid
  limit 1;

  -- Use seller's current currency from user_settings, default to INR
  eff_currency := coalesce(
    nullif(trim(upper(us_currency)), ''),
    'INR'
  );

  bp := coalesce(us_data -> 'businessProfile', '{}'::jsonb);

  -- Use seller's current logo from user_settings, fallback to empty string
  eff_logo := coalesce(
    nullif(trim(bp ->> 'logoUrl'), ''),
    ''
  );

  return jsonb_build_object(
    'storeId', rec.id,
    'sellerUserId', rec.seller_user_id,
    'storeSlug', rec.store_slug,
    'catalogueId', rec.catalogue_id,
    'sellerCurrencyCode', eff_currency,
    'sellerLogoUrl', eff_logo,
    'sellerBusinessName', nullif(trim(bp ->> 'businessName'), ''),
    'sellerAbout', nullif(trim(bp ->> 'about'), ''),
    'sellerPhone', nullif(trim(bp ->> 'phone'), ''),
    'sellerEmail', nullif(trim(bp ->> 'email'), ''),
    'sellerWebsite', nullif(trim(bp ->> 'website'), ''),
    'sellerAddress', nullif(trim(bp ->> 'address'), ''),
    'sellerDescription', nullif(trim(bp ->> 'description'), ''),
    'createdAt', rec.created_at,
    'isLive', coalesce(rec.is_live, true),
    'whatsapp', nullif(trim(rec.store_whatsapp), '')
  );
end;
$$;

revoke all on function public.get_store_by_slug(text) from public;
grant execute on function public.get_store_by_slug(text) to anon, authenticated;

### 4) Public RPC to Get Store Products

This RPC is called by unauthenticated users to fetch all products for a store. It returns the products array.

```sql
create or replace function public.get_store_products(p_seller_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  products_array jsonb;
begin
  -- `products.position` (int8) = drag order in the app; subquery ORDER BY ensures stable array order.
  select coalesce(
    jsonb_agg(q.m),
    '[]'::jsonb
  ) into products_array
  from (
    select (p.data || jsonb_build_object(
      'id', p.id,
      'product_id', p.product_id,
      'name', coalesce(p.name, p.data->>'name', 'Unnamed Product'),
      'sku', p.sku,
      'category_id', p.category_id,
      'position', p.position,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    )) as m
    from public.products p
    where p.user_id = p_seller_user_id::uuid
    and p.deleted_at is null
    order by p.position asc nulls last, p.created_at asc
  ) q;

  return jsonb_build_object(
    'products', coalesce(products_array, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_store_products(text) from public;
grant execute on function public.get_store_products(text) to anon, authenticated;
```

### 5) Extend Orders Table (Optional: Track Store-sourced Orders)

If you want to distinguish orders from stores vs. share links, add an optional column:

```sql
alter table public.orders
  add column if not exists store_id text;

-- Index for store orders lookup
create index if not exists orders_store_id_idx
  on public.orders (store_id);
```

Then in your app logic, set either `share_link_token` OR `store_id` (not both) when creating orders.

## Implementation Notes

### Slug Validation (App-side)
- Alphanumeric + hyphens only: `^[a-zA-Z0-9-]+$`
- Length: 3–50 characters
- Reject reserved words: `admin`, `api`, `store`, `o`, `orders`, etc.
- Uniqueness: Enforced by database `UNIQUE` constraint; catch `23505` error and suggest alternatives

### One Store Per Seller
- The `seller_user_id` column has a `UNIQUE` constraint
- Attempting to insert a second store will fail with a unique constraint violation
- In the app, check for existing store before insert; offer "update" instead

### Public RPC vs. Table Read
- Public users **cannot** directly select from `stores` table (RLS prevents it)
- They **must** call `get_store_by_slug()` to fetch a store
- The RPC merges live seller settings (currency, logo) so stores always show current brand info

### Store vs. Share Link Orders
- **Share Link**: Token snapshot of products + pricing at time of sharing (expires in 24h)
- **Store**: Live catalogue link; products and prices update in real-time
- Track with `share_link_token` (shares) OR `store_id` (stores) in orders table, not both

## Troubleshooting

1. **Slug uniqueness errors**: Catch `code === '23505'` (unique constraint violation) and suggest alternatives like `${slug}-2`
2. **Catalogue not found**: When updating, validate the catalogue exists before updating `catalogue_id`
3. **`user_settings` missing**: The RPC assumes `user_settings` exists and is readable by the function. If not, the function returns `null` for currency/logo
4. **Public access**: The `public_select_by_slug` policy allows anyone to read stores. This is intentional (stores are discoverable by slug).
