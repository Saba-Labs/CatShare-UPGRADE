-- Store security settings (visibility, access control, geo restrictions)
-- Apply in Supabase SQL editor or add as a migration.

alter table public.stores
  add column if not exists security_settings jsonb not null default '{
    "version": 1,
    "visibility": "public",
    "passwordProtected": false,
    "storePassword": "",
    "blockedCustomers": [],
    "allowedCountries": [],
    "twoFactorEnabled": false
  }'::jsonb;

comment on column public.stores.security_settings is 'Seller security: visibility, password gate, blocked customers, geo allowlist, 2FA toggle';
