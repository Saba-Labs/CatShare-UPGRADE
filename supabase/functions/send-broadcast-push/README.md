# send-broadcast-push

Sends a custom FCM notification to **all** distinct device tokens in `user_push_tokens` (same Firebase project as `send-order-push`).

## One-time setup

1. Set secrets (Supabase Dashboard → Project Settings → Edge Functions, or CLI):

   ```bash
   supabase secrets set BROADCAST_PUSH_SECRET="your-long-random-secret"
   ```

   `FIREBASE_SERVICE_ACCOUNT_JSON` should already be set for order pushes.

2. Deploy:

   ```bash
   supabase functions deploy send-broadcast-push --no-verify-jwt
   ```

## Invoke

Replace `YOUR_PROJECT_REF`, `YOUR_SECRET`, and the JSON body.

```bash
curl -sS -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-broadcast-push" \
  -H "Content-Type: application/json" \
  -H "x-catshare-broadcast-secret: YOUR_SECRET" \
  -d '{"title":"Update tonight","body":"Hello users, there is an update coming up tonight !!"}'
```

Optional extra `data` (all values become FCM data strings; `type` is always `broadcast`):

```json
{
  "title": "Maintenance",
  "body": "We will be down 22:00–23:00 IST.",
  "data": { "screen": "settings" }
}
```

## Response

`{ "ok": true, "sent": 42, "failed": 0, "totalTokens": 42 }` — `failed` counts FCM errors (invalid/expired tokens, etc.).

## Security

Keep `BROADCAST_PUSH_SECRET` private. Anyone with the URL + secret can message all users who have a stored push token.
