const HTTPS_URL = /^https?:\/\//i;

/**
 * Block Supabase upsert when a product still has a local image path but no cloud URL.
 * CatShare requires every catalogue image to exist in R2 (HTTPS imageUrl on the product row).
 */
export function assertProductsHaveCloudImageUrlForSync(products: any[], context: string): void {
  for (const p of products) {
    if (!p || p.id == null) continue;
    const hasPath = typeof p.imagePath === 'string' && p.imagePath.trim().length > 0;
    const url = typeof p.imageUrl === 'string' ? p.imageUrl.trim() : '';
    const hasCloudUrl = url.length > 0 && HTTPS_URL.test(url);
    if (hasPath && !hasCloudUrl) {
      throw new Error(
        `${context}: product "${String(p.name || '').trim() || p.id}" (${p.id}) has a local image but no cloud ` +
          `imageUrl. Sync cannot continue until the image is uploaded to cloud storage.`
      );
    }
  }
}
