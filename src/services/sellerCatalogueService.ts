/**
 * Seller product list fetch — mirrors `fetchSellerOrders` in orderService.ts:
 * offline reads device cache only; online loads from Supabase via fetchAllUserData.
 */
import { setSupabaseRlsUserId } from '../supabaseClient';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import {
  readProductsWithLegacyFallback,
  readDeletedProductsWithLegacyFallback,
} from '../utils/safeStorage';
import { persistSellerCatalogue } from '../utils/catalogueCachePersist';
import { fetchAllUserData } from './supabaseSync';

export type SellerCatalogueData = {
  products: any[];
  deletedProducts: any[];
};

export { persistSellerCatalogue, persistCatalogueSnapshotForUser } from '../utils/catalogueCachePersist';

export async function fetchSellerCatalogue(
  sellerUserId: string
): Promise<{ data: SellerCatalogueData | null; error: unknown }> {
  try {
    if (!sellerUserId || sellerUserId.trim() === '') {
      return { data: null, error: new Error('Seller user ID is required and cannot be empty') };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sellerUserId.trim())) {
      return {
        data: null,
        error: new Error('Invalid seller user ID format. Guest users use local catalogue only.'),
      };
    }

    const trimmed = sellerUserId.trim();

    if (!isBrowserOnline()) {
      const products = readProductsWithLegacyFallback(trimmed);
      const deletedProducts = readDeletedProductsWithLegacyFallback(trimmed);
      return { data: { products, deletedProducts }, error: null };
    }

    setSupabaseRlsUserId(trimmed);
    const result = await fetchAllUserData(trimmed);
    if (!result.success || !result.data) {
      const products = readProductsWithLegacyFallback(trimmed);
      const deletedProducts = readDeletedProductsWithLegacyFallback(trimmed);
      if (products.length > 0 || deletedProducts.length > 0) {
        persistSellerCatalogue(trimmed, products, deletedProducts);
        return { data: { products, deletedProducts }, error: null };
      }
      return { data: null, error: new Error(result.error || 'Failed to fetch catalogue') };
    }

    let products = Array.isArray(result.data.products) ? result.data.products : [];
    let deletedProducts = Array.isArray(result.data.deletedProducts)
      ? result.data.deletedProducts
      : [];

    // Lie-fi / RLS hiccup: do not replace a populated device cache with an empty snapshot.
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
    return { data: { products, deletedProducts }, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
