import { next } from '@vercel/functions';

/**
 * Internal probe: when present, middleware must not recurse into another probe/fetch.
 * Keep in sync with `src/utils/storefrontDomain.ts` (RESERVED_STORE_SLUGS).
 */
const STOREFRONT_PROBE_HEADER = 'x-catshare-storefront-probe';

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

/** Set `STOREFRONT_SUBDOMAIN_REDIRECT=false` (or `0` / `off` / `no`) to disable error failover entirely. */
function errorFailoverDisabled(): boolean {
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

/** Subresource / XHR GETs — do not probe (avoids double origin work and wrong redirects). */
function shouldSkipProbeForFetchMode(request: Request): boolean {
  const mode = request.headers.get('sec-fetch-mode');
  return mode === 'cors' || mode === 'no-cors';
}

function buildProbeRequest(request: Request, url: URL): Request {
  const headers = new Headers(request.headers);
  headers.set(STOREFRONT_PROBE_HEADER, '1');
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  headers.delete('if-range');
  headers.delete('range');
  const method = request.method === 'HEAD' ? 'HEAD' : 'GET';
  return new Request(url.toString(), { method, headers, redirect: 'follow' });
}

export default async function middleware(request: Request): Promise<Response> {
  if (errorFailoverDisabled()) return next();

  const url = new URL(request.url);
  if (isProbablyStaticAssetPath(url.pathname)) return next();

  if (request.headers.get(STOREFRONT_PROBE_HEADER) === '1') return next();

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

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  if (shouldSkipProbeForFetchMode(request)) return next();

  const probeReq = buildProbeRequest(request, url);
  let upstream: Response;
  try {
    upstream = await fetch(probeReq);
  } catch {
    // Timeouts / edge fetch issues — do not send users to another URL.
    return next();
  }

  if (upstream.status >= 200 && upstream.status < 400) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  }

  const dest = `${base}/store/${encodeURIComponent(slug)}${url.search}`;
  return Response.redirect(dest, 302);
}

export const config = {
  matcher: ['/((?!api/|assets/|_next/|.*\\..*).*)'],
};
