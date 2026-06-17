import type { ShareLinkItem } from '../services/shareLinks';
import { slugifyStorefront } from './websiteStorefront';

export function shareLinkItemHandle(item: ShareLinkItem): string {
  return slugifyStorefront(item.name || item.productId);
}

export function orderLinkBasePath(token: string): string {
  return `/o/${encodeURIComponent(token)}`;
}

export function orderLinkProductPath(token: string, item: ShareLinkItem): string {
  return `${orderLinkBasePath(token)}/products/${shareLinkItemHandle(item)}`;
}

/** Product slug from `/o/:token/products/:handle` (null when on the list page). */
export function parseOrderLinkProductHandle(pathname: string, token: string): string | null {
  const prefix = `/o/${token}/products/`;
  const idx = pathname.indexOf(prefix);
  if (idx === -1) return null;
  const rest = pathname.slice(idx + prefix.length).split('/')[0];
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

export function findShareLinkItemByHandle(
  items: ShareLinkItem[],
  handle: string
): ShareLinkItem | null {
  const normalized = handle.toLowerCase();
  return (
    items.find((item) => shareLinkItemHandle(item).toLowerCase() === normalized) ?? null
  );
}
