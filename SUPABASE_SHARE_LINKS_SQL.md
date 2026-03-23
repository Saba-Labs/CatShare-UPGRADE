## Supabase SQL for "Share as link" (Order Form)

Run this in the Supabase SQL editor.

### 1) Table

```sql
create table if not exists public.share_links (
  token text primary key,
  seller_user_id text not null,
  seller_whatsapp text not null,
  items jsonb not null,
  seller_business_name text,
  seller_currency_code text default 'INR',
  seller_currency_symbol text default '₹',
  seller_logo_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day')
);

create index if not exists share_links_seller_user_id_idx
  on public.share_links (seller_user_id);

create index if not exists share_links_expires_at_idx
  on public.share_links (expires_at);
```

### 1b) Business name in order form header (optional column)

Run once if the table already exists without this column:

```sql
alter table public.share_links
  add column if not exists seller_business_name text;

alter table public.share_links
  add column if not exists seller_currency_code text default 'INR';

alter table public.share_links
  add column if not exists seller_currency_symbol text default '₹';

alter table public.share_links
  add column if not exists seller_logo_url text;
```

### 2) RLS (seller can manage their own links)

```sql
alter table public.share_links enable row level security;

-- Seller can read only their own links
create policy "seller_select_own_links"
on public.share_links
for select
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can insert only for themselves
create policy "seller_insert_own_links"
on public.share_links
for insert
with check (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- Seller can delete only their own links (optional)
create policy "seller_delete_own_links"
on public.share_links
for delete
using (
  seller_user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);
```

### 3) Public RPC for customers (safe token lookup)

We do NOT allow public `select` on the table. Instead customers call this RPC.

**Important:** This version **merges `user_settings`** (seller’s current `currency` + `data.customCurrencies`, and **`businessProfile.logoUrl`**) so the order form shows the **same symbol and logo as in the app**, even for **old share links** that were saved with DB defaults (₹) or before currency columns existed.

```sql
create or replace function public.get_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  us_currency text;
  us_data jsonb;
  eff_code text;
  eff_sym text;
  eff_logo text;
  cust jsonb;
begin
  select
    sl.seller_whatsapp,
    sl.items,
    sl.expires_at,
    sl.seller_business_name,
    sl.seller_currency_code,
    sl.seller_currency_symbol,
    sl.seller_user_id,
    sl.seller_logo_url
  into rec
  from public.share_links sl
  where sl.token = p_token
  limit 1;

  if rec is null then
    return null;
  end if;

  if rec.expires_at <= now() then
    return null;
  end if;

  select u.currency, u.data
  into us_currency, us_data
  from public.user_settings u
  where u.user_id = rec.seller_user_id
  limit 1;

  -- Prefer live seller currency from user_settings, then snapshot on the link
  eff_code := upper(trim(coalesce(
    nullif(trim(us_currency), ''),
    nullif(trim(rec.seller_currency_code), ''),
    'INR'
  )));
  if eff_code = '' then
    eff_code := 'INR';
  end if;

  eff_sym := null;

  if us_data is not null and jsonb_typeof(us_data -> 'customCurrencies') = 'object' then
    cust := us_data -> 'customCurrencies';
    eff_sym := nullif(trim(cust ->> eff_code), '');
  else
    cust := '{}'::jsonb;
  end if;

  if eff_sym is null then
    eff_sym := case eff_code
      when 'USD' then '$'
      when 'EUR' then '€'
      when 'GBP' then '£'
      when 'JPY' then '¥'
      when 'INR' then '₹'
      when 'AUD' then 'A$'
      when 'CAD' then 'C$'
      when 'CHF' then 'CHF'
      when 'CNY' then '¥'
      when 'AED' then 'د.إ'
      when 'SGD' then 'S$'
      when 'HKD' then 'HK$'
      when 'MXN' then '$'
      when 'BRL' then 'R$'
      when 'ZAR' then 'R'
      else null
    end;
  end if;

  if eff_sym is null then
    eff_sym := nullif(trim(rec.seller_currency_symbol), '');
  end if;

  if eff_sym is null then
    eff_sym := case eff_code
      when 'USD' then '$'
      when 'EUR' then '€'
      when 'GBP' then '£'
      when 'JPY' then '¥'
      when 'INR' then '₹'
      when 'AUD' then 'A$'
      when 'CAD' then 'C$'
      when 'CHF' then 'CHF'
      when 'CNY' then '¥'
      when 'AED' then 'د.إ'
      when 'SGD' then 'S$'
      when 'HKD' then 'HK$'
      when 'MXN' then '$'
      when 'BRL' then 'R$'
      when 'ZAR' then 'R'
      else null
    end;
  end if;

  eff_sym := coalesce(eff_sym, '₹');

  -- Logo: live Account logo first, then snapshot on share_links
  eff_logo := nullif(trim(coalesce(
    nullif(trim(us_data -> 'businessProfile' ->> 'logoUrl'), ''),
    nullif(trim(rec.seller_logo_url), '')
  )), '');

  return jsonb_build_object(
    'sellerWhatsapp', rec.seller_whatsapp,
    'items', rec.items,
    'sellerBusinessName', coalesce(nullif(trim(rec.seller_business_name), ''), ''),
    'sellerCurrencyCode', eff_code,
    'sellerCurrencySymbol', eff_sym,
    'sellerCustomCurrencies', coalesce(cust, '{}'::jsonb),
    'sellerLogoUrl', coalesce(eff_logo, '')
  );
end;
$$;

revoke all on function public.get_share_link(text) from public;
grant execute on function public.get_share_link(text) to anon, authenticated;
```

**Deploy:** Run the block above in the Supabase SQL editor after `user_settings` exists. The function runs as **security definer** and reads `user_settings` for the link’s `seller_user_id` only.

### Troubleshooting: “Failed to create link”

1. **Currency columns** — If the app was deployed before `seller_currency_code` / `seller_currency_symbol` existed, inserts used to fail. The app now **retries without those columns** so links still work; run **§1b** so currency is stored correctly.

2. **`x-user-id` and RLS** — The policies above expect the browser to send `x-user-id` matching `seller_user_id`. The CatShare web app sets this header on every Supabase request when you’re signed in. If you use **different** policies (e.g. `auth.uid()::text = seller_user_id`), you don’t need the header.

3. **Customer order form** — **Replace `get_share_link`** with **§3** whenever you update this doc. The latest RPC merges **`user_settings`** so currency matches the seller’s app without re-sharing links.

4. **`user_settings` access** — `get_share_link` must be able to `SELECT` from `public.user_settings` (same schema). If your policies block the definer role, grant `SELECT` to the function owner or adjust policies; typical Supabase projects allow the `postgres` role full access.

