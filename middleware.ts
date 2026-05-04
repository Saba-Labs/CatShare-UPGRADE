import { next } from '@vercel/functions';

/**
 * Keep in sync with `src/utils/storefrontDomain.ts` (RESERVED_STORE_SLUGS).
 * Do not import storefrontDomain here — it pulls Vite `import.meta` client code.
 */
const RESERVED_STORE_SLUGS = new Set([
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
]);

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.+$/, '');
}

function isProbablyStaticAssetPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/assets/')) return true;
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? '';
  // Vite chunks, favicon, PWA assets, etc.
  if (last.includes('.')) return true;
  return false;
}

function resolveSellerSlugFromHost(hostname: string, rootDomain: string): string | null {
  const host = normalizeHost(hostname);
  const root = normalizeHost(rootDomain);
  if (!host || !root || host === root) return null;
  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;
  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  if (!/^[a-z0-9-]+$/.test(subdomain)) return null;
  if (RESERVED_STORE_SLUGS.has(subdomain)) return null;
  return subdomain;
}

function redirectDisabled(): boolean {
  const v = String(process.env.STOREFRONT_SUBDOMAIN_REDIRECT ?? '').trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'off' || v === 'no';
}

function fallbackOrigin(): string {
  const raw = String(process.env.STOREFRONT_FALLBACK_ORIGIN ?? '').trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://my.catshare.app';
}

function storefrontRootDomain(): string {
  const raw = String(process.env.STOREFRONT_ROOT_DOMAIN ?? '').trim();
  if (raw) return normalizeHost(raw);
  return 'catshare.app';
}

export default function middleware(request: Request) {
  if (redirectDisabled()) return next();

  const url = new URL(request.url);
  if (isProbablyStaticAssetPath(url.pathname)) return next();

  const host = normalizeHost(url.hostname);
  const root = storefrontRootDomain();
  const slug = resolveSellerSlugFromHost(host, root);
  if (!slug) return next();

  const base = fallbackOrigin();
  let fallbackHost = '';
  try {
    fallbackHost = normalizeHost(new URL(base).hostname);
  } catch {
    return next();
  }
  if (!fallbackHost || fallbackHost === host) return next();

  const dest = `${base}/store/${encodeURIComponent(slug)}${url.search}`;
  return Response.redirect(dest, 302);
}

export const config = {
  matcher: ['/((?!api/|assets/|_next/|.*\\..*).*)'],
};
