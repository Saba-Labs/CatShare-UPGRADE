## Supabase SQL for "Share as link" (Order Form)

Run this in the Supabase SQL editor.

### 1) Table

```sql
create table if not exists public.share_links (
  token text primary key,
  seller_user_id text not null,
  seller_whatsapp text not null,
  items jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists share_links_seller_user_id_idx
  on public.share_links (seller_user_id);

create index if not exists share_links_expires_at_idx
  on public.share_links (expires_at);
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

```sql
create or replace function public.get_share_link(p_token text)
returns jsonb
language plpgsql
security definer
as $$
declare
  rec record;
begin
  select seller_whatsapp, items, expires_at
    into rec
  from public.share_links
  where token = p_token
  limit 1;

  if rec is null then
    return null;
  end if;

  if rec.expires_at <= now() then
    return null;
  end if;

  return jsonb_build_object(
    'sellerWhatsapp', rec.seller_whatsapp,
    'items', rec.items
  );
end;
$$;

revoke all on function public.get_share_link(text) from public;
grant execute on function public.get_share_link(text) to anon, authenticated;
```

