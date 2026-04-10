/**
 * Read numeric ?v= from a stored product URL (API may embed ?v=timestamp in imageUrl).
 */
export function parseImageVersionFromUrl(imageUrl: string | undefined | null): number | undefined {
  const raw = String(imageUrl ?? "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return undefined;
  try {
    const u = new URL(raw);
    const q = u.searchParams.get("v");
    if (q && /^\d+$/.test(q)) {
      const n = parseInt(q, 10);
      return Number.isFinite(n) ? n : undefined;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Stable cache-busted URL for product images (Cloudflare / browser cache).
 * Uses imageVersion when set; otherwise reuses ?v= from the URL string if present.
 */
export function productImageDisplayUrl(
  imageUrl: string | undefined | null,
  imageVersion?: number | string | null
): string {
  const raw = String(imageUrl ?? "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return raw;
  let v: string | null =
    imageVersion != null && String(imageVersion).trim() !== ""
      ? String(imageVersion).trim()
      : null;
  if (!v) {
    const fromUrl = parseImageVersionFromUrl(raw);
    if (fromUrl != null) v = String(fromUrl);
  }
  if (!v) return raw;
  const base = raw.split("?")[0].split("#")[0];
  return `${base}?v=${encodeURIComponent(v)}`;
}
