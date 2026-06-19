/** Paths served by the public website storefront on a seller subdomain or custom domain. */
export function isPublicStorefrontPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return true;
  if (pathname.startsWith('/collections')) return true;
  if (pathname.startsWith('/products')) return true;
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return false;
  const appRoots = new Set([
    'login',
    'register',
    'forgot-password',
    'reset-password',
    'email-confirmed',
    'welcome',
    'catalogues',
    'orders',
    'create',
    'create-bulk',
    'create-order',
    'account',
    'settings',
    'website',
    'privacy',
    'terms',
    'o',
    'track',
    'api',
  ]);
  if (appRoots.has(seg)) return false;
  return pathname.split('/').filter(Boolean).length >= 1 && !pathname.startsWith('/store/');
}
