/**
 * After cloud sync, products may have imageUrl (R2) but no local file on this device.
 * Save/canvas rendering prefers filesystem imagePath; without it, remote fetch can fail (CORS).
 * This module downloads imageUrl and writes the same per-user path layout as CreateProduct.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getCataloguesDefinition } from '../config/catalogueConfig';
import { getUserImagePath } from './safeStorage';
import { safeWriteFile } from './platformFilesystem';
import { webCacheGet, webCachePut } from './productImageWebCache';
import { fetchUrlAsDataUrl } from './fetchImageCrossPlatform';

const HTTP_URL = /^https?:\/\//i;

function extractFolderFromImagePath(imagePath: unknown): string | null {
  if (typeof imagePath !== 'string') return null;
  const m = imagePath.match(/^user-[^/]+\/([^/]+)\/product-/);
  return m ? m[1] : null;
}

function resolveCatalogueFolder(product: any, userId: string): string {
  const fromPath = extractFolderFromImagePath(product.imagePath);
  if (fromPath) return fromPath;
  try {
    const def = getCataloguesDefinition(userId);
    const catId = typeof product.catalogueId === 'string' ? product.catalogueId : 'cat1';
    const cat = def.catalogues.find((c) => c.id === catId);
    if (cat?.folder) return cat.folder;
    if (def.catalogues[0]?.folder) return def.catalogues[0].folder;
  } catch {
    /* ignore */
  }
  return 'Master';
}

/** Match Save.jsx / CreateProduct: try Data first, then External (Android). */
async function localImageFileExists(path: string): Promise<boolean> {
  try {
    await Filesystem.readFile({ path, directory: Directory.Data });
    return true;
  } catch {
    try {
      await Filesystem.readFile({ path, directory: Directory.External });
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

function resolveTargetImagePath(product: any, userId: string): string {
  const folder = resolveCatalogueFolder(product, userId);
  return getUserImagePath(String(product.id), userId, folder);
}

/** Web: fetch imageUrl once and store data URL in IndexedDB for Save.jsx / canvas. */
async function cacheCloudProductImagesWeb(userId: string, products: any[]): Promise<any[]> {
  const out: any[] = [];
  for (const p of products) {
    if (!p || p.id == null) {
      out.push(p);
      continue;
    }

    const url = p.imageUrl;
    if (typeof url !== 'string' || !HTTP_URL.test(url.trim())) {
      out.push(p);
      continue;
    }

    try {
      const existing = await webCacheGet(userId, String(p.id));
      if (existing) {
        out.push(p);
        continue;
      }

      const dataUrl = await fetchUrlAsDataUrl(url.trim());
      await webCachePut(userId, String(p.id), dataUrl);
      out.push(p);
    } catch (e) {
      console.warn(`⚠️ cacheCloudProductImages (web): could not cache image for product ${p.id}:`, e);
      out.push(p);
    }
  }

  return out;
}

/**
 * After cloud sync or startup: for each product with imageUrl, ensure this device has the image
 * locally (native: Filesystem) or in IndexedDB (web) so canvas/PDF rendering works.
 */
export async function cacheCloudProductImages(userId: string, products: any[]): Promise<any[]> {
  if (!userId || !Array.isArray(products) || products.length === 0) {
    return products;
  }

  if (Capacitor.getPlatform() === 'web') {
    try {
      return await cacheCloudProductImagesWeb(userId, products);
    } catch (e) {
      console.warn('⚠️ cacheCloudProductImages (web):', e);
      return products;
    }
  }

  if (!Capacitor.isNativePlatform()) {
    return products;
  }

  const out: any[] = [];
  for (const p of products) {
    if (!p || p.id == null) {
      out.push(p);
      continue;
    }

    const url = p.imageUrl;
    if (typeof url !== 'string' || !HTTP_URL.test(url.trim())) {
      out.push(p);
      continue;
    }

    const targetPath = resolveTargetImagePath(p, userId);

    try {
      if (await localImageFileExists(targetPath)) {
        out.push(p.imagePath === targetPath ? p : { ...p, imagePath: targetPath });
        continue;
      }

      const dataUrl = await fetchUrlAsDataUrl(url.trim());
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

  return out;
}
