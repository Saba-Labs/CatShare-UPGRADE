import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import { normalizeProductCategories } from './productCategoryUtils';
import { getWebsiteProductImageUrl } from './websiteStorefront';

export interface StoreCategory {
  /** Stable id used for matching (lowercased category label). */
  id: string;
  /** Human-readable label as authored on products. */
  label: string;
  /** Number of products in this category. */
  count: number;
  /** Representative product image, if any. */
  imageUrl?: string;
}

/** Build the unique list of categories used across the store's products. */
export function deriveStoreCategories(products: ProductWithCatalogueData[]): StoreCategory[] {
  const map = new Map<string, StoreCategory>();

  for (const product of products) {
    const labels = normalizeProductCategories(product.category);
    for (const label of labels) {
      const id = label.toLowerCase();
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
        if (!existing.imageUrl) existing.imageUrl = getWebsiteProductImageUrl(product);
      } else {
        map.set(id, {
          id,
          label,
          count: 1,
          imageUrl: getWebsiteProductImageUrl(product),
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/** Match URL `?category=` value to a product category label when possible. */
export function resolveStoreCategoryParam(
  param: string | null | undefined,
  availableCategories: string[]
): string {
  const raw = param?.trim();
  if (!raw) return 'all';
  const target = raw.toLowerCase();
  const match = availableCategories.find((c) => c.toLowerCase() === target);
  return match ?? raw;
}

export function storeCategoriesMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Products belonging to a given category id (case-insensitive match). */
export function productsInCategory(
  products: ProductWithCatalogueData[],
  categoryId: string
): ProductWithCatalogueData[] {
  const target = String(categoryId).toLowerCase();
  return products.filter((p) =>
    normalizeProductCategories(p.category).some((c) => c.toLowerCase() === target)
  );
}
