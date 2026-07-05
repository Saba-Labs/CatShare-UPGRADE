/** True when the href should open as an external/mail/tel link (not in-app routing). */
export function isExternalHref(href: string): boolean {
  const trimmed = (href || '').trim();
  return /^(https?:|mailto:|tel:)/i.test(trimmed);
}

/**
 * Normalize links for storefront nav, buttons, and section content.
 * Preserves external URLs; store paths are forced to start with `/`.
 */
export function sanitizeStoreLinkHref(value: string): string {
  return normalizeStorefrontPath(value);
}

/**
 * Ensure in-app paths start with `/` so `products/foo` becomes `/products/foo`.
 * External URLs are returned unchanged.
 */
export function normalizeStorefrontPath(href: string): string {
  const trimmed = (href || '').trim();
  if (!trimmed || trimmed === '#') return '/';
  if (isExternalHref(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Resolve a storefront-relative path for React Router.
 * Paths like `/collections/all` become `/store/{slug}/collections/all` when basePath is set.
 */
export function resolveStorefrontHref(href: string, basePath: string): string {
  const trimmed = normalizeStorefrontPath(href);
  if (isExternalHref(trimmed)) return trimmed;

  const path = trimmed;
  const base = (basePath || '').replace(/\/$/, '');
  if (!base) return path;
  if (path === '/') return `${base}/`;

  const combined = `${base}${path}`;
  return combined.replace(/([^:]\/)\/+/g, '$1');
}
