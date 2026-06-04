# Supabase SQL — store custom domains

Run in the Supabase SQL editor after deploying the custom-domain feature.

## 1) Columns on `stores`

```sql
alter table public.stores
  add column if not exists custom_hostname text;

alter table public.stores
  add column if not exists custom_domain_status text;

alter table public.stores
  add column if not exists custom_domain_updated_at timestamptz;

-- One hostname globally (when set)
create unique index if not exists stores_custom_hostname_unique_idx
  on public.stores (custom_hostname)
  where custom_hostname is not null;

create index if not exists stores_custom_hostname_active_idx
  on public.stores (custom_hostname)
  where custom_domain_status = 'active';
```

`custom_domain_status`: `pending` | `active` | `error` | `null`

## 2) Public lookup by hostname (storefront)

```sql
create or replace function public.get_store_slug_by_hostname(p_hostname text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select store_slug
  from public.stores
  where lower(trim(custom_hostname)) = lower(trim(p_hostname))
    and custom_domain_status = 'active'
  limit 1;
$$;

grant execute on function public.get_store_slug_by_hostname(text) to anon, authenticated;
```

## 3) Vercel server environment variables

Set in the Vercel project (not in Vite):

| Variable | Description |
|----------|-------------|
| `VERCEL_API_TOKEN` | Vercel account token with domain scope |
| `VERCEL_PROJECT_ID` | Project ID or project name |
| `VERCEL_TEAM_ID` | Optional, if the project is under a team |

Also ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set for `/api/store-custom-domain`.
