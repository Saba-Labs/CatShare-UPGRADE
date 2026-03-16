## Supabase SQL for Subscriptions (`user_subscriptions`)

Paste everything below into the Supabase SQL editor and run.

```sql
-- 1) Table
create table if not exists public.user_subscriptions (
  user_id text primary key,
  platform text not null check (platform in ('android', 'ios')),
  product_id text not null,
  status text not null check (status in ('active', 'expired', 'canceled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists user_subscriptions_status_idx
  on public.user_subscriptions (status);

create index if not exists user_subscriptions_expires_at_idx
  on public.user_subscriptions (expires_at);

-- 2) RLS
alter table public.user_subscriptions enable row level security;

-- Users can read their own subscription row
create policy "user_select_own_subscription"
on public.user_subscriptions
for select
using (
  user_id = coalesce(
    (current_setting('request.headers', true)::json->>'x-user-id'),
    ''
  )
);

-- NOTE: Do NOT allow client-side inserts/updates by default.
-- The backend should verify receipts and then upsert with the service role key.
```

