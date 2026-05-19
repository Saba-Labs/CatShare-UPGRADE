import {
  buildProductImagePersistFields,
  getPrimaryImageIndex,
  getProductImageUrls,
  MAX_PRODUCT_IMAGES,
} from './productImages';

function productUpdatedTime(product: { updatedAt?: unknown } | null | undefined): number {
  const t = product?.updatedAt;
  if (t == null || t === '') return 0;
  const ms = new Date(String(t)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Merge gallery URLs from two product snapshots (deduped, max 5). */
function mergeImageUrlsFromProducts(local: any, remote: any): string[] {
  const combined = [...getProductImageUrls(local), ...getProductImageUrls(remote)];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of combined) {
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_PRODUCT_IMAGES) break;
  }
  return out;
}

/**
 * When timestamps tie or one side lacks updatedAt, keep the richer gallery and primary index
 * from the newer or more complete snapshot.
 */
export function reconcileProductImageFields(local: any, remote: any): Record<string, unknown> {
  const localUrls = getProductImageUrls(local);
  const remoteUrls = getProductImageUrls(remote);
  const localTime = productUpdatedTime(local);
  const remoteTime = productUpdatedTime(remote);

  if (localUrls.length === 0 && remoteUrls.length === 0) {
    return {};
  }

  let urls = mergeImageUrlsFromProducts(local, remote);
  if (urls.length === 0) {
    return {};
  }

  let primaryIndex = 0;
  if (localTime > remoteTime) {
    primaryIndex = getPrimaryImageIndex(local);
  } else if (remoteTime > localTime) {
    primaryIndex = getPrimaryImageIndex(remote);
  } else if (localUrls.length >= remoteUrls.length) {
    primaryIndex = getPrimaryImageIndex(local);
  } else {
    primaryIndex = getPrimaryImageIndex(remote);
  }

  if (primaryIndex >= urls.length) {
    primaryIndex = 0;
  }

  return buildProductImagePersistFields({ imageUrls: urls, primaryImageIndex: primaryIndex });
}

/**
 * Merge local + remote product lists (by id). Uses updatedAt on each product's JSON;
 * when timestamps conflict or are missing, unions imageUrls so extra gallery images are not dropped.
 */
export function mergeProductsData(
  local: any[],
  remote: any[],
  deletedIds: Set<string> = new Set()
): any[] {
  const merged = new Map<string, any>();

  local.forEach((product) => {
    if (product?.id == null) return;
    merged.set(String(product.id), product);
  });

  remote.forEach((remoteProduct) => {
    if (remoteProduct?.id == null) return;
    if (deletedIds.size > 0 && deletedIds.has(String(remoteProduct.id))) return;

    const id = String(remoteProduct.id);
    const localProduct = merged.get(id);

    if (!localProduct) {
      merged.set(id, remoteProduct);
      return;
    }

    const localTime = productUpdatedTime(localProduct);
    const remoteTime = productUpdatedTime(remoteProduct);
    const imagePatch = reconcileProductImageFields(localProduct, remoteProduct);

    if (remoteTime > localTime) {
      merged.set(id, { ...remoteProduct, ...imagePatch });
    } else if (localTime > remoteTime) {
      merged.set(id, { ...localProduct, ...imagePatch });
    } else {
      // Same timestamp (or both missing): prefer local fields, union images.
      merged.set(id, {
        ...remoteProduct,
        ...localProduct,
        ...imagePatch,
        updatedAt:
          localProduct.updatedAt || remoteProduct.updatedAt || new Date().toISOString(),
      });
    }
  });

  return Array.from(merged.values());
}
