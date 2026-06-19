-- Store security settings (password gate for public storefront)
alter table public.stores
  add column if not exists security_settings jsonb not null default '{
    "version": 1,
    "passwordProtected": false,
    "storePassword": ""
  }'::jsonb;

comment on column public.stores.security_settings is 'Store password gate for public storefront';
