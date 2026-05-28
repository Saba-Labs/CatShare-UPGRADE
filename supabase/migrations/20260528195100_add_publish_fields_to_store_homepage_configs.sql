alter table public.store_homepage_configs
add column if not exists published_layout jsonb,
add column if not exists published_at timestamptz;

comment on column public.store_homepage_configs.published_layout
is 'Published website/homepage payload used by public storefront runtime.';
