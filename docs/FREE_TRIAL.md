# Free Pro trial (14 days)

## Behavior

- Each **Supabase account** gets **14 days of full Pro access** from **`auth.users.created_at`** (account creation time).
- **Paid** subscription or **lifetime** purchase overrides trial messaging; entitlement still uses the same rules as before for purchases.
- **No Google Play Console** configuration is required for this app-managed trial.
- **No extra database table** is required: trial end is computed server-side as `created_at + 14 days`.

## API

`GET /api/subscription` (and Express `GET /subscription`) returns:

| Field | Meaning |
|--------|--------|
| `isPro` | Full Pro access (paid **or** within trial window) |
| `isPaidPro` | Active paid subscription or lifetime |
| `isTrialActive` | Pro access from trial only (`true` only when not paid and trial not expired) |
| `trialEndsAt` | ISO timestamp when trial ends |
| `trialDays` | `14` (constant from `lib/subscriptionEntitlement.mjs`) |

Shared logic lives in **`lib/subscriptionEntitlement.mjs`** (used by Vercel and `backend/server.js`).

## Existing accounts

Users who created accounts **more than 14 days ago** will have an **expired** trial immediately (same as “trial already used” by calendar time). To grant a promotional extension later, you could add a DB column or support table—**not** implemented in this version.

## Client

- **`SubscriptionContext`** exposes `isPro`, `isPaidPro`, `isTrialActive`, `trialEndsAt`, `trialDays`.
- **`ProInfo`** shows trial copy and keeps purchase options visible until `isPaidPro` is true.
