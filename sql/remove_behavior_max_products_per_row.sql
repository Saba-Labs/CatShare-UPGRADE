-- Remove deprecated behaviour keys: maxProducts, productsPerRow.
-- Product grid layout uses stores.view_mode (grid/list) and responsive CSS instead.

-- Strip from existing rows
update public.stores
set behavior_settings = behavior_settings - 'maxProducts' - 'productsPerRow'
where behavior_settings ?| array['maxProducts', 'productsPerRow'];

-- New default for future stores (no maxProducts / productsPerRow)
alter table public.stores
  alter column behavior_settings set default '{
    "version": 1,
    "productsToShow": "all",
    "defaultSorting": "newest",
    "productImageRatio": "square",
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
