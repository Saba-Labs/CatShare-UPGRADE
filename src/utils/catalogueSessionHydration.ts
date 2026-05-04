/**
 * Per-session flags so bottom-nav route changes (unmount/remount) do not re-hit the same
 * heavy Supabase paths for the same seller on every visit.
 * Cleared on logout — next sign-in loads fresh.
 */

/** `fetchSellerCatalogue` → `fetchAllUserData` (large payload). */
const cloudHydratedSellerUids = new Set<string>();

/** `getSellerStore` — single row; safe to skip repeat on tab return. */
const storeRowFetchedSellerUids = new Set<string>();

export function markSellerCatalogueCloudHydrated(uid: string): void {
  const id = String(uid ?? '').trim();
  if (id) cloudHydratedSellerUids.add(id);
}

export function markSellerStoreRowFetched(uid: string): void {
  const id = String(uid ?? '').trim();
  if (id) storeRowFetchedSellerUids.add(id);
}

export function hasSellerStoreRowFetched(uid: string): boolean {
  return storeRowFetchedSellerUids.has(String(uid ?? '').trim());
}

/** After delete store / similar — next Store tab visit should hit the network again. */
export function invalidateSellerStoreSessionFetch(uid: string): void {
  storeRowFetchedSellerUids.delete(String(uid ?? '').trim());
}

export function clearSellerCatalogueSessionHydration(uid?: string): void {
  if (uid != null && String(uid).trim() !== '') {
    const id = String(uid).trim();
    cloudHydratedSellerUids.delete(id);
    storeRowFetchedSellerUids.delete(id);
    return;
  }
  cloudHydratedSellerUids.clear();
  storeRowFetchedSellerUids.clear();
}

export function hasSellerCatalogueCloudHydrated(uid: string): boolean {
  return cloudHydratedSellerUids.has(String(uid ?? '').trim());
}
