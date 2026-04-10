/**
 * After cloud sync, products may have imageUrl (R2) but no local file on this device.
 * Source images live at user-<uid>/Products/product-<id>.png (see getUserImagePath).
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getUserImagePath } from './safeStorage';
import { fetchUrlAsDataUrl } from './fetchImageCrossPlatform';
import { safeWriteFile } from './platformFilesystem';

const HTTP_URL = /^https?:\/\//i;

/** Max parallel downloads + writes per batch (keeps memory stable on low-end devices). */
const CACHE_IMAGE_CONCURRENCY = 4;

async function localImageFileExists(path: string): Promise<boolean> {
  try {
    await Filesystem.readFile({ path, directory: Directory.External });
    return true;
  } catch {
    try {
      await Filesystem.readFile({ path, directory: Directory.Data });
      return true;
    } catch {
      return false;
    }
  }
}

function stripDataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  if (i === -1) return dataUrl;
  return dataUrl.slice(i + 1);
}

export type CacheCloudImageProgress = {
  current: number;
  total: number;
  productName?: string;
};

/**
 * For native apps: ensure each product with imageUrl has a local source file at the Products path.
 * Optional `onProgress`: once per product row that has an `id` (in order), for live UI during long syncs.
 */
export async function cacheCloudProductImages(
  userId: string,
  products: any[],
  onProgress?: (info: CacheCloudImageProgress) => void
): Promise<any[]> {
  if (!Capacitor.isNativePlatform() || !userId || !Array.isArray(products) || products.length === 0) {
    return products;
  }

  const totalWithId = products.reduce((n, p) => n + (p?.id != null ? 1 : 0), 0);
  let seenWithId = 0;

  const urlCacheKey = `cloudImageUrlCache::${userId}`;
  let previousUrlMap: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(urlCacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        previousUrlMap = parsed as Record<string, string>;
      }
    }
  } catch {
    /* ignore */
  }
  const nextUrlMap: Record<string, string> = {};

  const computeOne = async (i: number): Promise<any> => {
    const p = products[i];
    if (!p || p.id == null) {
      return p;
    }

    const url = p.imageUrl;
    if (typeof url !== 'string' || !HTTP_URL.test(url.trim())) {
      return p;
    }
    const normalizedUrl = url.trim();
    const pid = String(p.id);
    nextUrlMap[pid] = normalizedUrl;

    const targetPath = getUserImagePath(String(p.id), userId);
    const cachedUrl = previousUrlMap[pid] || '';
    const urlChanged = cachedUrl !== normalizedUrl;

    try {
      if (!urlChanged && (await localImageFileExists(targetPath))) {
        return p.imagePath === targetPath ? p : { ...p, imagePath: targetPath };
      }

      const dataUrl = await fetchUrlAsDataUrl(normalizedUrl);
      const base64 = stripDataUrlToBase64(dataUrl);
      const ok = await safeWriteFile({ path: targetPath, data: base64 });
      if (!ok) {
        console.warn(`⚠️ cacheCloudProductImages: write failed for product ${p.id}`);
        return p;
      }

      return { ...p, imagePath: targetPath };
    } catch (e) {
      console.warn(`⚠️ cacheCloudProductImages: could not cache image for product ${p.id}:`, e);
      return p;
    }
  };

  const out: any[] = new Array(products.length);

  for (let batchStart = 0; batchStart < products.length; batchStart += CACHE_IMAGE_CONCURRENCY) {
    const batchEnd = Math.min(batchStart + CACHE_IMAGE_CONCURRENCY, products.length);
    for (let i = batchStart; i < batchEnd; i++) {
      const p = products[i];
      if (p && p.id != null) {
        seenWithId += 1;
        const rawName = typeof p.name === 'string' ? p.name.trim() : '';
        const productName =
          rawName.length > 42 ? `${rawName.slice(0, 39)}…` : rawName || undefined;
        onProgress?.({ current: seenWithId, total: totalWithId, productName });
      }
    }

    const slice = await Promise.all(
      Array.from({ length: batchEnd - batchStart }, (_, k) => computeOne(batchStart + k))
    );
    for (let k = 0; k < slice.length; k++) {
      out[batchStart + k] = slice[k];
    }
  }

  try {
    localStorage.setItem(urlCacheKey, JSON.stringify(nextUrlMap));
  } catch {
    /* ignore */
  }

  return out;
}
