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

/** Merge gallery URLs from two product snapshots, keeping the preferred gallery first. */
function mergeImageUrlsFromProducts(preferred: any, secondary: any): string[] {
  const combined = [...getProductImageUrls(preferred), ...getProductImageUrls(secondary)];
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

/** Keep the winning snapshot's gallery ordering so its primary-image index stays valid. */
export function reconcileProductImageFields(local: any, remote: any): Record<string, unknown> {
  const localUrls = getProductImageUrls(local);
  const remoteUrls = getProductImageUrls(remote);
  const localTime = productUpdatedTime(local);
  const remoteTime = productUpdatedTime(remote);

  if (localUrls.length === 0 && remoteUrls.length === 0) {
    return {};
  }

  const preferRemote =
    remoteTime > localTime || (remoteTime === localTime && remoteUrls.length > localUrls.length);
  const primaryProduct = preferRemote ? remote : local;
  const secondaryProduct = preferRemote ? local : remote;
  const urls = mergeImageUrlsFromProducts(primaryProduct, secondaryProduct);
  if (urls.length === 0) {
    return {};
  }

  const primaryIndex = getPrimaryImageIndex(primaryProduct);
  return buildProductImagePersistFields({ imageUrls: urls, primaryImageIndex: primaryIndex });
}

/**
 * Merge local + remote product lists (by id). Uses updatedAt on each product's JSON;
 * when timestamps conflict or are missing, unions imageUrls so extra gallery images are not dropped.
 */
export type MergeProductsOptions = {
  /** When updatedAt ties, prefer cloud row (used on refreshFromCloud / reload). */
  preferRemoteOnTie?: boolean;
};

export function mergeProductsData(
  local: any[],
  remote: any[],
  deletedIds: Set<string> = new Set(),
  options?: MergeProductsOptions
): any[] {
  const preferRemoteOnTie = options?.preferRemoteOnTie === true;
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
      // Same timestamp (or both missing): on cloud refresh prefer remote; otherwise keep local edits.
      const base = preferRemoteOnTie
        ? { ...localProduct, ...remoteProduct }
        : { ...remoteProduct, ...localProduct };
      merged.set(id, {
        ...base,
        ...imagePatch,
        updatedAt:
          remoteProduct.updatedAt || localProduct.updatedAt || new Date().toISOString(),
      });
    }
  });

  return Array.from(merged.values());
}
