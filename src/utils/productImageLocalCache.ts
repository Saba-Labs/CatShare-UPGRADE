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

  const out: any[] = [];
  for (const p of products) {
    if (!p || p.id == null) {
      out.push(p);
      continue;
    }

    seenWithId += 1;
    const rawName = typeof p.name === 'string' ? p.name.trim() : '';
    const productName =
      rawName.length > 42 ? `${rawName.slice(0, 39)}…` : rawName || undefined;
    onProgress?.({ current: seenWithId, total: totalWithId, productName });

    const url = p.imageUrl;
    if (typeof url !== 'string' || !HTTP_URL.test(url.trim())) {
      out.push(p);
      continue;
    }
    const normalizedUrl = url.trim();
    const pid = String(p.id);
    nextUrlMap[pid] = normalizedUrl;

    const targetPath = getUserImagePath(String(p.id), userId);
    const cachedUrl = previousUrlMap[pid] || '';
    const urlChanged = cachedUrl !== normalizedUrl;

    try {
      if (!urlChanged && (await localImageFileExists(targetPath))) {
        out.push(p.imagePath === targetPath ? p : { ...p, imagePath: targetPath });
        continue;
      }

      const dataUrl = await fetchUrlAsDataUrl(normalizedUrl);
      const base64 = stripDataUrlToBase64(dataUrl);
      const ok = await safeWriteFile({ path: targetPath, data: base64 });
      if (!ok) {
        console.warn(`⚠️ cacheCloudProductImages: write failed for product ${p.id}`);
        out.push(p);
        continue;
      }

      out.push({ ...p, imagePath: targetPath });
    } catch (e) {
      console.warn(`⚠️ cacheCloudProductImages: could not cache image for product ${p.id}:`, e);
      out.push(p);
    }
  }

  try {
    localStorage.setItem(urlCacheKey, JSON.stringify(nextUrlMap));
  } catch {
    /* ignore */
  }

  return out;
}
