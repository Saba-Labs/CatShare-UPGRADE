/**
 * Write catalogue rows to keyed localStorage (`products::uid`, `deletedProducts::uid`).
 * Kept separate from sellerCatalogueService so AuthContext does not import the fetch stack
 * (avoids circular module init where SyncContext cannot read `useAuth`).
 */
import {
  readProductsWithLegacyFallback,
  readDeletedProductsWithLegacyFallback,
  safeSetProductsCache,
  safeSetDeletedProductsCache,
} from './safeStorage';

export function persistSellerCatalogue(
  sellerUserId: string,
  products: any[],
  deletedProducts: any[]
): void {
  const trimmed = sellerUserId.trim();
  if (!trimmed) return;
  safeSetProductsCache(trimmed, products);
  safeSetDeletedProductsCache(trimmed, deletedProducts);
}

/**
 * Merge a cloud snapshot with device cache (lie-fi / empty RLS snapshot must not wipe a full cache),
 * then persist.
 */
export function persistCatalogueSnapshotForUser(
  userId: string,
  cloudProducts: unknown,
  cloudDeleted: unknown
): void {
  const trimmed = typeof userId === 'string' ? userId.trim() : '';
  if (!trimmed) return;

  let products = Array.isArray(cloudProducts) ? cloudProducts : [];
  let deletedProducts = Array.isArray(cloudDeleted) ? cloudDeleted : [];

  const localP = readProductsWithLegacyFallback(trimmed);
  const localD = readDeletedProductsWithLegacyFallback(trimmed);
  if (
    products.length === 0 &&
    deletedProducts.length === 0 &&
    (localP.length > 0 || localD.length > 0)
  ) {
    products = localP;
    deletedProducts = localD;
  }

  persistSellerCatalogue(trimmed, products, deletedProducts);
}

/**
 * Active catalogue rows from device storage (mirrors SyncContext offline branch).
 * Use whenever cloud is unreachable but `navigator.onLine` may still be true.
 */
export function getCatalogueRowsFromDeviceStorage(userId: string): {
  products: any[];
  deletedProducts: any[];
} {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid) return { products: [], deletedProducts: [] };

  const nextProducts = readProductsWithLegacyFallback(uid);
  const nextDeleted = readDeletedProductsWithLegacyFallback(uid);
  const deletedIds = new Set<string>(
    nextDeleted.map((p: any) => p?.id).filter((id: any) => id != null).map((id: any) => String(id))
  );
  const filteredProducts = nextProducts.filter(
    (p: any) => p?.id != null && !deletedIds.has(String(p.id))
  );
  return { products: filteredProducts, deletedProducts: nextDeleted };
}
