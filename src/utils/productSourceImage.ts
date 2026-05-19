/**
 * Canonical on-device source photo: user-<uid>/Products/product-<id>.png
 * (one file per product; catalogue renders read this + JSON fields.)
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getAllCatalogues } from '../config/catalogueConfig';
import { getPersistedAuthUserId } from './authUserId';
import { getUserImagePath } from './safeStorage';
import { fetchUrlAsDataUrl } from './fetchImageCrossPlatform';
import { safeWriteFile } from './platformFilesystem';
import {
  buildDataUrlFromDiskBase64,
  normalizeExistingDataUrlMime,
} from './imageDataUrlMime';
import {
  getProductImageUrls,
  getProductPrimaryImageUrl,
  getProductPrimaryImageVersion,
} from './productImages';
import { productImageDisplayUrl } from './imageUrl';

const HTTP_URL = /^https?:\/\//i;

export function getEffectiveUserIdForImages(): string {
  return getPersistedAuthUserId() || '';
}

/** True if the string can be passed to canvas Image() / loadImage (data, http(s), blob). */
export function isRenderableImageSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length === 0) return false;
  return (
    s.startsWith('data:') ||
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('blob:')
  );
}

/**
 * Remove stale `product.image` values (e.g. filesystem paths synced from another device)
 * so hydration can load from disk / imageUrl.
 */
export function clearNonRenderableProductImage(product: any): void {
  if (!product || typeof product.image !== 'string') return;
  if (isRenderableImageSource(product.image)) return;
  delete product.image;
}

/**
 * Pick pixels for canvas: hydrated product first, then catalogue overlay, then imageUrl.
 * Never prefers catalogue `image` over a valid hydrated `product.image`.
 */
export function pickRenderableImageForCanvas(
  product: { image?: unknown; imageUrl?: unknown },
  catalogueOverlay: { image?: unknown } | null | undefined
): string {
  if (isRenderableImageSource(product?.image)) return String(product.image).trim();
  if (isRenderableImageSource(catalogueOverlay?.image)) {
    return String(catalogueOverlay.image).trim();
  }
  if (isRenderableImageSource(product?.imageUrl)) {
    return String(product.imageUrl).trim();
  }
  if (typeof product?.image === 'string' && product.image.length > 0) {
    return product.image;
  }
  return '';
}

/** Unique ordered paths to try when reading a product's source image (newest convention first). */
export function getOrderedSourceImagePaths(product: { id?: unknown; imagePath?: unknown }): string[] {
  const uid = getEffectiveUserIdForImages();
  if (!uid || product?.id == null) {
    const single = typeof product.imagePath === 'string' ? product.imagePath.trim() : '';
    return single ? [single] : [];
  }

  const id = String(product.id);
  const canonical = getUserImagePath(id, uid);
  const ordered: string[] = [canonical];

  const stored =
    typeof product.imagePath === 'string' && product.imagePath.trim()
      ? product.imagePath.trim()
      : '';
  if (stored && stored !== canonical) {
    ordered.push(stored);
  }

  /** Avoid dozens of legacy paths (one per catalogue) → hundreds of failed readFile calls and console spam. */
  const MAX_LEGACY_CATALOGUE_PATHS = 5;
  let legacyAdded = 0;
  try {
    for (const cat of getAllCatalogues(uid)) {
      if (legacyAdded >= MAX_LEGACY_CATALOGUE_PATHS) break;
      const folder = cat.folder || cat.label;
      if (!folder) continue;
      const legacy = `user-${uid}/${folder}/product-${id}.png`;
      if (!ordered.includes(legacy)) {
        ordered.push(legacy);
        legacyAdded++;
      }
    }
  } catch {
    /* ignore */
  }

  return ordered;
}

async function readFileDataBase64(path: string): Promise<string | null> {
  // Android source writes prefer External; read it first to avoid stale Data copies
  // shadowing freshly replaced images.
  try {
    const res = await Filesystem.readFile({ path, directory: Directory.External });
    if (res?.data) return String(res.data);
  } catch {
    /* try Data fallback */
  }
  try {
    const res = await Filesystem.readFile({ path, directory: Directory.Data });
    if (res?.data) return String(res.data);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Read raw base64 for a single path (Data then External). Use for R2 upload from on-disk paths.
 */
export async function readProductImageFileBase64(path: string): Promise<string | null> {
  return readFileDataBase64(path);
}

/**
 * For cloud sync: read source bytes using the same path order as hydration (canonical, imagePath, legacy).
 * Ensures uploads work when CreateProduct wrote to External or path metadata is slightly off.
 */
export async function readProductSourceBase64ForCloudUpload(product: {
  id?: unknown;
  imagePath?: unknown;
}): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  for (const path of getOrderedSourceImagePaths(product)) {
    if (!path) continue;
    const b64 = await readFileDataBase64(path);
    if (b64) return b64;
  }
  return null;
}

function stripDataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  if (i === -1) return dataUrl;
  return dataUrl.slice(i + 1);
}

/**
 * Try to read a product source image as a data URL for thumbnails (e.g. imageMap).
 */
export async function tryReadProductSourceAsDataUrl(product: {
  id?: unknown;
  imagePath?: unknown;
  imageUrl?: unknown;
}): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    for (const path of getOrderedSourceImagePaths(product)) {
      const b64 = await readFileDataBase64(path);
      if (b64) {
        return buildDataUrlFromDiskBase64(b64, path);
      }
    }
  }

  const primary = getProductPrimaryImageUrl(product);
  if (primary && HTTP_URL.test(primary)) {
    return productImageDisplayUrl(primary, getProductPrimaryImageVersion(product));
  }
  return null;
}

/**
 * Load source pixels for canvas/share: disk (canonical + legacy), copy to canonical when read from legacy,
 * then imageUrl. Updates product.image and normalizes product.imagePath on native when possible.
 */
export async function hydrateProductSourceForRender(product: any): Promise<boolean> {
  clearNonRenderableProductImage(product);

  if (
    product?.image &&
    typeof product.image === 'string' &&
    product.image.startsWith('data:') &&
    product.image.length > 64
  ) {
    product.image = normalizeExistingDataUrlMime(product.image);
    const payload = stripDataUrlToBase64(product.image);
    try {
      atob(payload.replace(/\s/g, '').slice(0, Math.min(payload.length, 120)));
    } catch {
      delete product.image;
    }
  }

  if (
    product?.image &&
    typeof product.image === 'string' &&
    product.image.startsWith('data:') &&
    product.image.length > 64
  ) {
    return true;
  }

  const uid = getEffectiveUserIdForImages();
  const isNative = Capacitor.isNativePlatform();
  const canonical =
    uid && product?.id != null ? getUserImagePath(String(product.id), uid) : '';

  const galleryUrls = getProductImageUrls(product);
  const cloudPrimary = getProductPrimaryImageUrl(product);
  if (galleryUrls.length > 0 && cloudPrimary && HTTP_URL.test(cloudPrimary)) {
    try {
      const dataUrl = await fetchUrlAsDataUrl(
        productImageDisplayUrl(cloudPrimary, getProductPrimaryImageVersion(product))
      );
      product.image = dataUrl;
      if (isNative && canonical) {
        const base64 = stripDataUrlToBase64(dataUrl);
        const ok = await safeWriteFile({ path: canonical, data: base64 });
        if (ok) {
          product.imagePath = canonical;
        }
      }
      return true;
    } catch (e) {
      console.warn('hydrateProductSourceForRender: primary cloud image fetch failed', e);
    }
  }

  if (isNative && canonical) {
    for (const path of getOrderedSourceImagePaths(product)) {
      const b64 = await readFileDataBase64(path);
      if (!b64) continue;

      product.image = buildDataUrlFromDiskBase64(b64, path);
      if (path !== canonical) {
        const ok = await safeWriteFile({ path: canonical, data: b64 });
        if (ok) {
          product.imagePath = canonical;
        } else {
          product.imagePath = path;
        }
      } else {
        product.imagePath = canonical;
      }
      return true;
    }
  }

  const url = typeof product?.imageUrl === 'string' ? product.imageUrl.trim() : '';
  if (url && HTTP_URL.test(url)) {
    try {
      const dataUrl = await fetchUrlAsDataUrl(url);
      product.image = dataUrl;
      if (isNative && canonical) {
        const base64 = stripDataUrlToBase64(dataUrl);
        const ok = await safeWriteFile({ path: canonical, data: base64 });
        if (ok) {
          product.imagePath = canonical;
        }
      }
      return true;
    } catch (e) {
      console.warn('hydrateProductSourceForRender: imageUrl fetch failed', e);
    }
  }

  return !!(product?.image && typeof product.image === 'string' && product.image.length > 0);
}

/** Best-effort delete source file(s) for a product (canonical + legacy paths). */
export async function deleteProductSourceImagesBestEffort(product: {
  id?: unknown;
  imagePath?: unknown;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const paths = new Set(getOrderedSourceImagePaths(product));
  for (const path of paths) {
    if (!path) continue;
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
      /* ignore */
    }
    try {
      await Filesystem.deleteFile({ path, directory: Directory.External });
    } catch {
      /* ignore */
    }
  }
}
