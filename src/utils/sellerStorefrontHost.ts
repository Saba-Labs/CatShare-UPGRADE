import { isPlatformAppHostname, resolveStoreSlugFromHostname } from './storefrontDomain';

/** True on `{slug}.catshare.app` or a seller custom domain (not the main CatShare app host). */
export function isSellerStorefrontHost(hostname?: string | null): boolean {
  const host =
    typeof hostname === 'string' && hostname.trim()
      ? hostname.trim().toLowerCase()
      : typeof window !== 'undefined'
        ? window.location.hostname.trim().toLowerCase()
        : '';
  if (!host) return false;
  if (resolveStoreSlugFromHostname(host)) return true;
  return !isPlatformAppHostname(host);
}
