import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
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

function normalizeCategoryValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/** Build the unique list of categories used across the store's products. */
export function deriveStoreCategories(products: ProductWithCatalogueData[]): StoreCategory[] {
  const map = new Map<string, StoreCategory>();

  for (const product of products) {
    const labels = normalizeCategoryValues(product.category);
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

/** Products belonging to a given category id (case-insensitive match). */
export function productsInCategory(
  products: ProductWithCatalogueData[],
  categoryId: string
): ProductWithCatalogueData[] {
  const target = String(categoryId).toLowerCase();
  return products.filter((p) =>
    normalizeCategoryValues(p.category).some((c) => c.toLowerCase() === target)
  );
}
