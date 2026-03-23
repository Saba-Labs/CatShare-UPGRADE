# R2 / public bucket CORS (optional but recommended for web)

Capacitor Android/iOS loads your app from an origin like **`https://localhost`**. The browser **blocks** `fetch` / `XMLHttpRequest` to your R2 public URLs unless the bucket sends **CORS** headers that allow that origin.

We use **`@capacitor-community/http` on native** so image downloads and canvas prep work **without** relying on WebView CORS. For **pure web** builds (browser), you still need CORS on the bucket if you load images via `fetch`.

## Cloudflare R2 CORS (manual)

1. Cloudflare Dashboard → **R2** → your bucket → **Settings** → **CORS policy** (or use the API / Wrangler).
2. Add a rule similar to:

```json
[
  {
    "AllowedOrigins": [
      "https://localhost",
      "http://localhost",
      "http://localhost:5173",
      "capacitor://localhost"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Include any **real** origins you use in production (e.g. `https://app.yourdomain.com`).
4. If you use a **custom domain** in front of R2, configure CORS on that bucket / zone as Cloudflare documents for your setup.

## After dependency changes

From the project root:

```bash
npm install
npx cap sync
```

Rebuild the Android/iOS app so the native **HTTP** plugin is linked.
