/**
 * Multi-image product helpers (max 5 URLs). Primary drives list/render/share via imageUrl.
 */

import { parseImageVersionFromUrl } from './imageUrl';

export const MAX_PRODUCT_IMAGES = 5;

const HTTPS_URL = /^https?:\/\//i;

function stripUrlQuery(url: string): string {
  const s = String(url ?? '').trim();
  if (!s) return '';
  const i = s.indexOf('?');
  return i === -1 ? s : s.slice(0, i);
}

/** Ordered gallery URLs (https only), max 5. */
export function getProductImageUrls(product: { imageUrls?: unknown; imageUrl?: unknown } | null | undefined): string[] {
  if (!product || typeof product !== 'object') return [];
  const raw = (product as { imageUrls?: unknown }).imageUrls;
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const u of raw) {
      if (typeof u !== 'string') continue;
      const t = u.trim();
      if (!t || !HTTPS_URL.test(t)) continue;
      if (!out.includes(t)) out.push(t);
      if (out.length >= MAX_PRODUCT_IMAGES) break;
    }
    if (out.length > 0) return out;
  }
  const single = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
  if (single && HTTPS_URL.test(single)) return [single];
  return [];
}

export function getPrimaryImageIndex(product: { primaryImageIndex?: unknown; imageUrls?: unknown; imageUrl?: unknown } | null | undefined): number {
  const urls = getProductImageUrls(product);
  if (urls.length === 0) return 0;
  const raw = (product as { primaryImageIndex?: unknown })?.primaryImageIndex;
  let idx = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
  if (idx < 0 || idx >= urls.length) idx = 0;
  return idx;
}

export function getProductPrimaryImageUrl(product: { imageUrls?: unknown; imageUrl?: unknown; primaryImageIndex?: unknown } | null | undefined): string {
  const urls = getProductImageUrls(product);
  if (urls.length === 0) {
    const legacy = typeof product?.imageUrl === 'string' ? product.imageUrl.trim() : '';
    return legacy && HTTPS_URL.test(legacy) ? legacy : '';
  }
  const i = getPrimaryImageIndex(product);
  return urls[i] || urls[0] || '';
}

export function getProductPrimaryImageVersion(product: {
  imageVersion?: unknown;
  imageUrl?: unknown;
  imageUrls?: unknown;
  primaryImageIndex?: unknown;
} | null | undefined): number | undefined {
  const primaryUrl = getProductPrimaryImageUrl(product);
  if (!primaryUrl) return undefined;
  if (typeof product?.imageVersion === 'number' && Number.isFinite(product.imageVersion)) {
    return product.imageVersion;
  }
  return parseImageVersionFromUrl(primaryUrl);
}

/** All distinct HTTPS image URLs stored on the product (for R2 delete). */
export function getAllProductImageUrlsForDeletion(product: { imageUrls?: unknown; imageUrl?: unknown } | null | undefined): string[] {
  const set = new Set<string>();
  for (const u of getProductImageUrls(product)) {
    set.add(stripUrlQuery(u));
  }
  const legacy = typeof product?.imageUrl === 'string' ? stripUrlQuery(product.imageUrl.trim()) : '';
  if (legacy && HTTPS_URL.test(legacy)) set.add(legacy);
  return Array.from(set);
}

/**
 * After removing slot `deletedIndex` (0-based) from imageUrls before splice:
 * - If deleted was primary → new primary index 0.
 * - Else if deleted < primary → primary -= 1.
 * - Else unchanged. Then clamp to new length.
 */
export function primaryIndexAfterSlotRemoved(
  deletedIndex: number,
  primaryIndex: number,
  lengthBeforeRemove: number
): number {
  if (lengthBeforeRemove <= 1) return 0;
  let p = primaryIndex;
  if (deletedIndex === primaryIndex) {
    p = 0;
  } else if (deletedIndex < primaryIndex) {
    p = primaryIndex - 1;
  }
  const newLen = lengthBeforeRemove - 1;
  if (p < 0) p = 0;
  if (p >= newLen) p = Math.max(0, newLen - 1);
  return p;
}

/**
 * Align `imageUrl` / `imageVersion` with the primary slot in `imageUrls`.
 * Fixes stale `imageUrl` when gallery metadata was updated but legacy fields were not.
 */
export function normalizeProductImageFields<T extends Record<string, unknown>>(product: T): T {
  if (!product || typeof product !== 'object') return product;

  const urls = getProductImageUrls(product);
  if (urls.length === 0) {
    const legacy = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
    if (legacy && HTTPS_URL.test(legacy)) {
      return {
        ...product,
        imageUrls: [legacy],
        primaryImageIndex: 0,
        imageUrl: legacy,
      } as T;
    }
    return product;
  }

  const fields = buildProductImagePersistFields({
    imageUrls: urls,
    primaryImageIndex: getPrimaryImageIndex(product),
  });
  return { ...product, ...fields } as T;
}

/** Persist fields: imageUrls, primaryImageIndex, imageUrl + imageVersion from primary slot. */
export function buildProductImagePersistFields(options: {
  imageUrls: string[];
  primaryImageIndex: number;
}): { imageUrls: string[]; primaryImageIndex: number; imageUrl?: string; imageVersion?: number } {
  const urls = options.imageUrls
    .map((u) => String(u ?? '').trim())
    .filter((u) => HTTPS_URL.test(u))
    .filter((u, i, a) => a.indexOf(u) === i)
    .slice(0, MAX_PRODUCT_IMAGES);

  let primary = Math.floor(options.primaryImageIndex);
  if (urls.length === 0) {
    return { imageUrls: [], primaryImageIndex: 0 };
  }
  if (primary < 0 || primary >= urls.length) primary = 0;

  const primaryUrl = urls[primary];
  const v = parseImageVersionFromUrl(primaryUrl);
  return {
    imageUrls: urls,
    primaryImageIndex: primary,
    imageUrl: primaryUrl,
    ...(typeof v === 'number' && Number.isFinite(v) ? { imageVersion: v } : {}),
  };
}
