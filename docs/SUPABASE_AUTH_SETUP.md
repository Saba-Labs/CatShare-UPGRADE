# Supabase Auth setup (after Firebase sign-in removal)

The app uses **Supabase Auth** for email, password reset, and Google. Firebase may still be initialized for **Analytics / FCM / other non-auth** features.

## What you must configure

### 1. Environment variables

**Frontend (`.env.local`, Capacitor build):**

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Project URL from Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |
| `VITE_BACKEND_URL` | **Required for Capacitor builds:** same as your Vercel URL (e.g. `https://your-app.vercel.app`). Native apps load from `https://localhost`; without this, `/api/upload-product-image` and subscription calls fail. |
| `VITE_APP_URL` | Optional fallback for API base (R2 helpers); prefer `VITE_BACKEND_URL` for clarity |

**Vercel (or Node server) — server-only, never expose to the client:**

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role** key — used to validate JWTs in `/api/*` |
| R2 vars | `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL` (optional `R2_ENDPOINT`) |

### 2. Supabase Dashboard → Authentication

- Enable **Email** (and **Google** if you use it).
- **Site URL**: your production web URL (e.g. `https://catshare.vercel.app`).
- **Redirect URLs**: add every URL that completes OAuth or magic links, e.g.  
  `http://localhost:5173/**`, `https://your-domain/login`, `capacitor://localhost` if required by your flow.
- For quick testing you can **disable email confirmations** (Auth → Providers → Email).

### 3. Google Sign-In

- In Supabase → Auth → Google: add **Client ID** / **Secret** from Google Cloud Console.
- For **Android**, add the release **SHA-1** to the OAuth client used by your app / Supabase, matching `@codetrix-studio/capacitor-google-auth` config in `capacitor.config` / `strings.xml` as you already do.

### 4. Database / subscriptions

- New users get a **UUID** from Supabase (`auth.users.id`). Any table keyed by `user_id` (e.g. `user_subscriptions`) should use that UUID.
- If you previously stored **Firebase UIDs**, clear or migrate test rows; there is **no automatic migration** of auth identities.

### 5. Optional: Firebase service account

- `FIREBASE_SERVICE_ACCOUNT_JSON` may still be needed for **Google Play billing verification** (`verify-purchase` / publisher API), **not** for end-user login.

### 6. Local Express backend (`backend/server.js`)

- Uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to verify `Authorization: Bearer <supabase_access_token>` on `/upload-product-image`, `/subscription`, `/iap/*`.
- Ensure the app sends the **Supabase session access token** (the client already does for Pro / IAP after this migration).

## Quick verification

1. Sign up / sign in; confirm rows in Supabase **Authentication → Users**.
2. Call `/api/subscription` with `Authorization: Bearer <access_token>` from the session (or use the app Pro screen).
3. Upload a catalogue image with cloud sync on — confirm R2 keys under `{supabase_user_id}/...` or `products/{uuid}/...`.
