/** True when the href should open as an external/mail/tel link (not in-app routing). */
export function isExternalHref(href: string): boolean {
  const trimmed = (href || '').trim();
  return /^(https?:|mailto:|tel:)/i.test(trimmed);
}

/**
 * Resolve a storefront-relative path for React Router.
 * Paths like `/collections/all` become `/store/{slug}/collections/all` when basePath is set.
 */
export function resolveStorefrontHref(href: string, basePath: string): string {
  const trimmed = (href || '').trim();
  if (!trimmed || trimmed === '#') return basePath || '/';
  if (isExternalHref(trimmed)) return trimmed;

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!basePath) return path;
  if (path === '/') return basePath;

  const combined = `${basePath}${path}`;
  return combined.replace(/([^:]\/)\/+/g, '$1');
}
