# Order form currency & logo

The public order form (`/o/:token`) loads data via Supabase RPC **`get_share_link`**.

## Behaviour

1. **App (seller)** — When creating an order link, currency comes from **`user_settings`** in memory (`supabaseData.userSettings`: `currency` + `data.customCurrencies`) when available, otherwise localStorage. See `getSellerCurrencyForShareLink()` in `src/utils/currencyUtils.ts`. The **business logo URL** is taken from `businessProfile.logoUrl` (same as Account) and stored on the link as `seller_logo_url` when the column exists.

2. **Supabase** — **`get_share_link`** (see `SUPABASE_SHARE_LINKS_SQL.md` §3) resolves:
   - **Code:** `user_settings.currency` first, then the snapshot on `share_links`.
   - **Symbol:** custom map from `user_settings.data.customCurrencies`, then built-in ISO symbols, then the snapshot on `share_links`.
   - **`sellerCustomCurrencies`** in the JSON so the client can still resolve symbols if needed.
   - **`sellerLogoUrl`:** `user_settings.data.businessProfile.logoUrl` first, then `share_links.seller_logo_url`.

3. **Order form (buyer)** — Uses `resolveShareLinkCurrencyDisplay()` so custom codes work when the RPC returns `sellerCustomCurrencies`. The header shows the logo image when `sellerLogoUrl` is a valid `http(s)` URL; otherwise the default store icon.

## What you must do

**Run the latest §1b + §3 SQL in the Supabase SQL editor** (add `seller_logo_url` if needed, replace `get_share_link`). Without this, production keeps the old RPC.

After deploying the app + SQL, **existing links** should show the seller’s current currency and logo from `user_settings` without re-sharing.
