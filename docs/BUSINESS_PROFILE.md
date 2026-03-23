# Business profile (`user_settings.data.businessProfile`)

Seller-facing fields are stored in Supabase **`user_settings.data`** as JSON under **`businessProfile`** (camelCase). They are **independent** of login email / profile name.

| Field | Type | Notes |
|--------|------|--------|
| `logoUrl` | string | R2 URL after upload (`productId` = `business-logo`) or pasted URL |
| `businessName` | string | |
| `address` | string | Multiline |
| `email` | string | Business contact email |
| `phone` | string | Business phone (separate from WhatsApp order number) |
| `website` | string | |
| `about` | string | Short line |
| `description` | string | Longer text |

## Merge behavior

`syncUserSettings` **merges** the `data` JSON and **deep-merges** `businessProfile` so other syncs (watermark, `customCurrencies`, etc.) do not wipe business details.

## Client

- **Account** page: edit + **Save business details**.
- **`localStorage` key `businessProfile`**: updated when cloud settings are applied (`SyncContext`) and after a successful save on Account.

## Auth

- **`refreshSupabaseData()`** on `AuthContext` refetches `user_settings` after saves.
