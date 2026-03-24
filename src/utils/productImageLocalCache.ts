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

/**
 * For native apps: ensure each product with imageUrl has a local source file at the Products path.
 */
export async function cacheCloudProductImages(userId: string, products: any[]): Promise<any[]> {
  if (!Capacitor.isNativePlatform() || !userId || !Array.isArray(products) || products.length === 0) {
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

    const targetPath = getUserImagePath(String(p.id), userId);

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
