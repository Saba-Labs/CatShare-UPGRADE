-- Order shipping address + unique shipment per order (Shiprocket AWB flow)
-- Run once in Supabase SQL editor.

alter table public.orders
  add column if not exists shipping_address jsonb;

comment on column public.orders.shipping_address is
  'Delivery address: { line1, line2?, city, state, pincode, country? }';

create unique index if not exists order_shipments_order_id_unique_idx
  on public.order_shipments (order_id);
