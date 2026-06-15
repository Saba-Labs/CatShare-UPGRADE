-- Checkout settings (shipping, tax, discounts) + order breakdown
-- Same as supabase/migrations/20260613120000_store_checkout_settings.sql

alter table public.stores
  add column if not exists checkout_settings jsonb not null default '{"version":1,"rules":[],"showBreakdown":true,"allowCouponEntry":true,"enableCod":false}'::jsonb;

alter table public.orders
  add column if not exists checkout_adjustments jsonb,
  add column if not exists payment_method text;

comment on column public.stores.checkout_settings is 'Seller-defined shipping, tax, and discount rules for storefront checkout';
comment on column public.orders.checkout_adjustments is 'Applied checkout lines (shipping, tax, discount) at order time';
comment on column public.orders.payment_method is 'prepaid | cod';
