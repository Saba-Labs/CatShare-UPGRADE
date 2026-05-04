import { getPublicWebBaseUrl } from './publicWebBaseUrl';

const DEFAULT_STOREFRONT_ROOT_HOST = 'catshare.app';

export const RESERVED_STORE_SLUGS = [
  'admin',
  'api',
  'app',
  'account',
  'blog',
  'create-order',
  'dashboard',
  'home',
  'login',
  'logout',
  'mail',
  'my',
  'o',
  'orders',
  'register',
  'settings',
  'share',
  'store',
  'support',
  'www',
];

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.+$/, '');
}

function getLikelyRootDomain(host: string): string {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

/**
 * *.vercel.app (and similar) are multi-tenant preview hosts — the left label is the *project*,
 * not a seller slug. Never infer storefront root from these or `resolveStoreSlugFromHostname`
 * will treat `catshare.vercel.app` as slug "catshare".
 */
function looksLikeHostingPreviewHostname(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  return /\.(vercel\.app|netlify\.app|pages\.dev|pages\.github\.io|cloudflarepages\.net)$/i.test(h);
}

export function getStorefrontRootHost(): string {
  const fromEnv = normalizeHost(String(import.meta.env.VITE_STOREFRONT_ROOT_DOMAIN || ''));
  if (fromEnv) return getLikelyRootDomain(fromEnv);

  let publicHost = '';
  try {
    publicHost = normalizeHost(new URL(getPublicWebBaseUrl()).hostname);
  } catch {
    publicHost = '';
  }

  if (!publicHost || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(publicHost)) {
    return DEFAULT_STOREFRONT_ROOT_HOST;
  }

  if (looksLikeHostingPreviewHostname(publicHost)) {
    return DEFAULT_STOREFRONT_ROOT_HOST;
  }

  return getLikelyRootDomain(publicHost);
}

export function buildStorefrontUrl(slug: string): string {
  const normalizedSlug = normalizeHost(slug);
  const rootHost = getStorefrontRootHost();
  return `https://${normalizedSlug}.${rootHost}`;
}

/**
 * Base URL for path-based store links when leaving a seller subdomain (e.g. client fallback after a failed fetch).
 * Prefer `VITE_PUBLIC_WEB_BASE_URL` / `VITE_APP_URL`; otherwise `https://my.<storefront root>`.
 * Avoids using `window.location.origin` on `*.catshare.app` seller hosts, which would not escape the subdomain.
 */
export function getStorePathFallbackBaseUrl(): string {
  const env = String(import.meta.env.VITE_PUBLIC_WEB_BASE_URL || import.meta.env.VITE_APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (env) return env;
  return `https://my.${getStorefrontRootHost()}`;
}

export function resolveStoreSlugFromHostname(hostname?: string | null): string | null {
  const host =
    normalizeHost(
      typeof hostname === 'string' ? hostname : typeof window !== 'undefined' ? window.location.hostname : ''
    );
  if (!host) return null;

  // Only match seller subdomains against the configured storefront root — not the browser host's
  // registrable domain (e.g. *.vercel.app would wrongly use the project name as a store slug).
  const rootHost = getStorefrontRootHost();
  if (!rootHost || host === rootHost) return null;
  const suffix = `.${rootHost}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  if (!/^[a-z0-9-]+$/.test(subdomain)) return null;
  if (RESERVED_STORE_SLUGS.includes(subdomain)) return null;
  return subdomain;
}
