/**
 * Purge Cloudflare CDN cache for specific file URLs (e.g. after R2 overwrite with same key).
 * Requires CF_ZONE_ID + CF_API_TOKEN (Cache Purge: Custom Purge) in env. No-op if unset.
 */
export async function purgeCloudflareCacheForUrls(urls: string[]): Promise<void> {
  const zoneId = process.env.CF_ZONE_ID;
  const token = process.env.CF_API_TOKEN;
  if (!zoneId || !token || urls.length === 0) return;

  const files = [
    ...new Set(
      urls
        .map((u) => {
          try {
            const x = new URL(u);
            x.search = "";
            x.hash = "";
            return x.toString();
          } catch {
            return String(u).split("?")[0].split("#")[0];
          }
        })
        .filter(Boolean)
    ),
  ];

  if (files.length === 0) return;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[purgeCloudflareCacheForUrls]", res.status, err);
  }
}
