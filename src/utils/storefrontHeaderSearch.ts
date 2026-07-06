import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import { productMatchesSearchQuery } from './productSearchUtils';
import type { StoreCategory } from './storefrontCategories';

export function searchStoreCategories(
  categories: StoreCategory[],
  query: string,
  limit = 5
): StoreCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return categories
    .filter((category) => {
      const label = category.label.toLowerCase();
      return label.includes(q) || category.id.includes(q);
    })
    .slice(0, limit);
}

export function searchStoreProducts(
  products: ProductWithCatalogueData[],
  query: string,
  limit = 8
): ProductWithCatalogueData[] {
  const q = query.trim();
  if (!q) return [];
  const results: ProductWithCatalogueData[] = [];
  for (const product of products) {
    if (!productMatchesSearchQuery(product, q)) continue;
    results.push(product);
    if (results.length >= limit) break;
  }
  return results;
}
