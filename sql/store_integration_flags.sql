-- Public storefront flags: which integrations affect checkout (address, payments).
-- Synced from seller_integrations when connect/disconnect runs.

alter table public.stores
  add column if not exists integration_flags jsonb not null default '{"razorpay":false,"shiprocket":false}'::jsonb;

comment on column public.stores.integration_flags is
  'Denormalized flags for public storefront: razorpay=online payments, shiprocket=requires delivery address';

create unique index if not exists order_payments_order_id_unique_idx
  on public.order_payments (order_id);
