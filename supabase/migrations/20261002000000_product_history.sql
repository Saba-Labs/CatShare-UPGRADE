create table if not exists public.product_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  entry_id text not null,
  occurred_at timestamptz not null,
  source text not null check (source in ('created', 'product', 'variants', 'bulk')),
  entry jsonb not null check (jsonb_typeof(entry) = 'object'),
  primary key (user_id, product_id, entry_id)
);

create index if not exists product_history_recent_idx
  on public.product_history (user_id, product_id, occurred_at desc, entry_id desc);

alter table public.product_history enable row level security;

grant select, insert, delete on public.product_history to authenticated;

create policy "Users can read their own product history"
  on public.product_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can add their own product history"
  on public.product_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own product history"
  on public.product_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.trim_product_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_history
  where user_id = new.user_id
    and product_id = new.product_id
    and entry_id not in (
      select entry_id
      from public.product_history
      where user_id = new.user_id
        and product_id = new.product_id
      order by occurred_at desc, entry_id desc
      limit 20
    );
  return new;
end;
$$;

revoke all on function public.trim_product_history() from public, anon, authenticated;

create trigger trim_product_history_after_insert
  after insert on public.product_history
  for each row execute function public.trim_product_history();
