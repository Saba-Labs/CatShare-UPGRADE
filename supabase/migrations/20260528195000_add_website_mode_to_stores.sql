alter table public.stores
add column if not exists website_mode_enabled boolean not null default false;

comment on column public.stores.website_mode_enabled
is 'Enables full website runtime on /store/:slug routes.';
