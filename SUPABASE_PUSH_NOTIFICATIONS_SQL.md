# Push notifications (FCM when app is killed)

Run in Supabase SQL Editor so the app can **save device tokens** and the Edge Function can read them with the service role.

## 1) Table `user_push_tokens`

```sql
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists user_push_tokens_user_id_idx
  on public.user_push_tokens (user_id);

alter table public.user_push_tokens enable row level security;

-- Signed-in users: only their own rows
create policy "user_push_tokens_select_own"
  on public.user_push_tokens for select
  using (auth.uid() = user_id);

create policy "user_push_tokens_insert_own"
  on public.user_push_tokens for insert
  with check (auth.uid() = user_id);

create policy "user_push_tokens_update_own"
  on public.user_push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_push_tokens_delete_own"
  on public.user_push_tokens for delete
  using (auth.uid() = user_id);
```

## 2) Database webhook (send FCM on new order)

After deploying the Edge Function `send-order-push`:

1. **Supabase Dashboard → Database → Webhooks → Create**
2. **Table:** `orders` · **Events:** Insert
3. **HTTP Request**
   - **URL:** `https://<PROJECT_REF>.supabase.co/functions/v1/send-order-push`
   - **Headers:** add  
     - `Content-Type`: `application/json`  
     - `x-catshare-secret`: **same value** as secret `ORDER_PUSH_WEBHOOK_SECRET` in Edge Functions
4. Save.

The function ignores `manual` orders (same rule as the app).

## 3) Edge Function secrets

In **Project Settings → Edge Functions → Secrets** (or CLI `supabase secrets set`):

| Secret | Description |
|--------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON of Firebase service account (Firebase Console → Project settings → Service accounts → Generate new private key). |
| `ORDER_PUSH_WEBHOOK_SECRET` | Random long string; must match webhook header `x-catshare-secret`. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for Edge Functions.

Deploy:

```bash
supabase functions deploy send-order-push --no-verify-jwt
```

(`--no-verify-jwt` matches `verify_jwt = false` so Database Webhooks can call without a user JWT.)

---

## Your checklist (what to do on your side)

1. **Run the SQL** in §1 in the Supabase SQL Editor (creates `user_push_tokens` + RLS).

2. **Firebase Console** (same project as `google-services.json` in the Android app):
   - **Project settings → Service accounts → Generate new private key** → download JSON.
   - You will paste this JSON into a Supabase secret (one long line is fine).

3. **Supabase Dashboard → Edge Functions → Secrets** (or CLI `supabase secrets set`):
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = entire contents of that JSON (string).
   - `ORDER_PUSH_WEBHOOK_SECRET` = a long random string (e.g. 32+ chars). Remember it for the webhook header.

4. **Deploy the function** from your machine (with [Supabase CLI](https://supabase.com/docs/guides/cli) installed and project linked):

   ```bash
   supabase functions deploy send-order-push --no-verify-jwt
   ```

5. **Database webhook** (§2): point `orders` **INSERT** to  
   `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-order-push`  
   with header **`x-catshare-secret`** = same value as `ORDER_PUSH_WEBHOOK_SECRET`.

6. **Rebuild the Android app** and install from Play (or internal track): `google-services.json` must stay in `android/app/` so FCM tokens are valid.

7. **On device**: open the app, sign in, **allow notifications** when prompted. A row should appear in `user_push_tokens` for your user.

8. **Test**: kill the app completely, place a test order for that seller; a system notification should appear within a few seconds.

**iOS:** This flow targets **Android FCM** first. iOS needs APNs configured in Firebase + Xcode capabilities; `PushNotifications` on iOS can work after that, but you may need extra native setup.

**If something fails:** Check **Edge Function → Logs** in Supabase; check that `user_push_tokens` has a token for the seller’s `user_id` (same as `orders.seller_user_id`).
