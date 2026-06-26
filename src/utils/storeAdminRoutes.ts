/** First path segment after `/store/` used by the seller dashboard — not public store slugs. */
export const STORE_ADMIN_ROUTE_SEGMENTS = new Set([
  'settings',
  'business',
  'payments',
  'shipping',
  'checkout',
  'domain',
  'analytics',
  'marketing',
  'integrations',
  'security',
  'homepage',
  'custom-domain',
  'checkout-settings',
]);

export function isStoreAdminDashboardSlug(slug: string | undefined | null): boolean {
  if (!slug) return false;
  return STORE_ADMIN_ROUTE_SEGMENTS.has(slug.trim().toLowerCase());
}
