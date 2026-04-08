/**
 * Canonical origin for public links (store URL, etc.).
 * - In the browser on Vercel, `window.location.origin` is correct when env is unset.
 * - In Capacitor / WebView, origin is often `https://localhost`; set `VITE_PUBLIC_WEB_BASE_URL`
 *   (or `VITE_APP_URL`) at build time to your deployed host (e.g. https://catshare.vercel.app).
 */
export function getPublicWebBaseUrl(): string {
  const fromEnv = String(
    import.meta.env.VITE_PUBLIC_WEB_BASE_URL || import.meta.env.VITE_APP_URL || ''
  ).trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}
