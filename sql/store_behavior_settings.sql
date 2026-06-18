-- Maintenance mode: storefront shows maintenance message while store stays editable.
alter table public.stores
  add column if not exists maintenance_mode boolean not null default false;

comment on column public.stores.maintenance_mode is 'When true, public storefront shows maintenance screen (store may still be is_live for seller tools).';

-- Behaviour preferences (catalogue, display, customer UX toggles).
alter table public.stores
  add column if not exists behavior_settings jsonb not null default '{
    "version": 1,
    "productsToShow": "all",
    "maxProducts": 100,
    "defaultSorting": "newest",
    "productImageRatio": "square",
    "productsPerRow": "2",
    "showPrice": true,
    "showAvailability": true,
    "showCategories": true,
    "defaultCurrency": "INR",
    "defaultLanguage": "en",
    "customerNotifications": true,
    "allowGuestBrowsing": true,
    "requireLoginBeforeCheckout": false,
    "timeZone": "UTC",
    "businessCountry": "IN",
    "defaultShippingRegion": "worldwide",
    "debugMode": false,
    "developerMode": false
  }'::jsonb;

comment on column public.stores.behavior_settings is 'Seller store behaviour: catalogue filters, display toggles, customer UX prefs';

-- Ensure minimum order column exists (MOQ for cart total).
alter table public.stores
  add column if not exists minimum_order_value numeric;

alter table public.stores
  add column if not exists view_mode text default 'grid';
