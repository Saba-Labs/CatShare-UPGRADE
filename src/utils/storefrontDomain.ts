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

  return getLikelyRootDomain(publicHost);
}

export function buildStorefrontUrl(slug: string): string {
  const normalizedSlug = normalizeHost(slug);
  const rootHost = getStorefrontRootHost();
  return `https://${normalizedSlug}.${rootHost}`;
}

export function resolveStoreSlugFromHostname(hostname?: string | null): string | null {
  const host =
    normalizeHost(
      typeof hostname === 'string' ? hostname : typeof window !== 'undefined' ? window.location.hostname : ''
    );
  if (!host) return null;

  const rootCandidates = Array.from(new Set([getStorefrontRootHost(), getLikelyRootDomain(host)]));
  for (const rootHost of rootCandidates) {
    if (!rootHost || host === rootHost) continue;
    const suffix = `.${rootHost}`;
    if (!host.endsWith(suffix)) continue;

    const subdomain = host.slice(0, -suffix.length);
    if (!subdomain || subdomain.includes('.')) continue;
    if (!/^[a-z0-9-]+$/.test(subdomain)) continue;
    if (RESERVED_STORE_SLUGS.includes(subdomain)) continue;
    return subdomain;
  }

  return null;
}
