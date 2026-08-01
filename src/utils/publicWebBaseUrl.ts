/**
 * Canonical origin for public links (store URL, etc.).
 * - In the browser on Vercel, `window.location.origin` is correct when env is unset.
 * - In Capacitor / WebView, origin is often `https://localhost`; set `VITE_PUBLIC_WEB_BASE_URL`
 *   (or `VITE_APP_URL`) at build time to your deployed host (e.g. https://my.catshare.app).
 */
export function getPublicWebBaseUrl(): string {
  const fallback = 'https://my.catshare.app';
  const normalize = (value: string): string => {
    const normalized = value.replace(/\/$/, '');
    try {
      return new URL(normalized).hostname === 'catshare.vercel.app' ? fallback : normalized;
    } catch {
      return normalized;
    }
  };

  const fromEnv = String(
    import.meta.env.VITE_PUBLIC_WEB_BASE_URL || import.meta.env.VITE_APP_URL || ''
  ).trim();
  if (fromEnv) return normalize(fromEnv);
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    // Native WebView / local dev origins should not leak into public share URLs.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return fallback;
    }
    return normalize(origin);
  }
  return fallback;
}
