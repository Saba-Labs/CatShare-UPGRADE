import { getProductPrimaryImageUrl } from './productImages';

const HTTPS_URL = /^https?:\/\//i;

/**
 * Block Supabase upsert when a product still has a local image path but no cloud URL.
 * CatShare requires every catalogue image to exist in R2 (HTTPS imageUrl on the product row).
 */
export function assertProductsHaveCloudImageUrlForSync(products: any[], context: string): void {
  for (const p of products) {
    if (!p || p.id == null) continue;
    const hasPath = typeof p.imagePath === 'string' && p.imagePath.trim().length > 0;
    const primaryCloud = getProductPrimaryImageUrl(p);
    const hasCloudUrl = primaryCloud.length > 0 && HTTPS_URL.test(primaryCloud);
    if (hasPath && !hasCloudUrl) {
      throw new Error(
        `${context}: product "${String(p.name || '').trim() || p.id}" (${p.id}) has a local image but no cloud ` +
          `imageUrl. Sync cannot continue until the image is uploaded to cloud storage.`
      );
    }
    const rawArr = p.imageUrls;
    if (Array.isArray(rawArr)) {
      for (const u of rawArr) {
        if (u == null) continue;
        const t = String(u).trim();
        if (!t) continue;
        if (!HTTPS_URL.test(t)) {
          throw new Error(
            `${context}: product "${String(p.name || '').trim() || p.id}" (${p.id}) has a non-cloud image URL in imageUrls. ` +
              `Sync cannot continue until all images are uploaded to cloud storage.`
          );
        }
      }
    }
  }
}
