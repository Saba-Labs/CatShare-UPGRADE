import {
  getCatalogueData,
  isProductEnabledForCatalogue,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import type { Catalogue } from '../config/catalogueConfig';
import { getStorefrontPriceAndUnit } from '../components/Storefront/storefrontOrderHelpers';
import { normalizeProductCategories } from './productCategoryUtils';
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  type DefaultSorting,
  type ProductImageRatio,
  type ProductsPerRow,
  type ProductsToShow,
  type StoreBehaviorSettings,
} from '../types/storeBehaviorSettings';

export function resolveBehaviorCatalogueId(
  productsToShow: ProductsToShow,
  storeCatalogueId: string,
  catalogues: Catalogue[]
): string {
  if (productsToShow === 'wholesale') {
    return catalogues.find((c) => c.id === 'cat1')?.id ?? storeCatalogueId;
  }
  if (productsToShow === 'reseller') {
    return catalogues.find((c) => c.id === 'cat2')?.id ?? storeCatalogueId;
  }
  return storeCatalogueId;
}

function isFeaturedProduct(product: ProductWithCatalogueData, catalogueId: string): boolean {
  const top = product as Record<string, unknown>;
  if (top.featured === true || top.isFeatured === true) return true;
  const catData = getCatalogueData(product, catalogueId) as Record<string, unknown> | undefined;
  if (catData?.featured === true || catData?.isFeatured === true) return true;
  const badge = String(catData?.badge ?? top.badge ?? '').trim().toLowerCase();
  return badge === 'featured';
}

export function filterProductsByBehaviorScope(
  products: ProductWithCatalogueData[],
  productsToShow: ProductsToShow,
  catalogueId: string
): ProductWithCatalogueData[] {
  switch (productsToShow) {
    case 'featured': {
      const featured = products.filter((p) => isFeaturedProduct(p, catalogueId));
      return featured.length > 0 ? featured : products;
    }
    case 'category':
      return products.filter((p) => normalizeProductCategories(p.category).length > 0);
    case 'wholesale':
    case 'reseller':
      return products.filter((p) => isProductEnabledForCatalogue(p, catalogueId));
    default:
      return products;
  }
}

function listPriceForSort(
  product: ProductWithCatalogueData,
  catalogueId: string,
  catalogue: Catalogue | null
): number {
  const catData = getCatalogueData(product, catalogueId);
  const { price } = getStorefrontPriceAndUnit(catData, catalogue, product, null, 0);
  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
}

export function sortStorefrontProducts(
  products: ProductWithCatalogueData[],
  sorting: DefaultSorting,
  catalogueId: string,
  catalogue: Catalogue | null
): ProductWithCatalogueData[] {
  const copy = [...products];
  switch (sorting) {
    case 'oldest':
      return copy.reverse();
    case 'price-low':
      return copy.sort(
        (a, b) =>
          listPriceForSort(a, catalogueId, catalogue) - listPriceForSort(b, catalogueId, catalogue)
      );
    case 'price-high':
      return copy.sort(
        (a, b) =>
          listPriceForSort(b, catalogueId, catalogue) - listPriceForSort(a, catalogueId, catalogue)
      );
    case 'alphabetical':
      return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    case 'newest':
    default:
      return copy;
  }
}

export function applyMaxProducts(
  products: ProductWithCatalogueData[],
  maxProducts: number
): ProductWithCatalogueData[] {
  const limit = Math.max(1, Math.floor(maxProducts));
  return products.length > limit ? products.slice(0, limit) : products;
}

export function productImageAspectRatio(ratio: ProductImageRatio): string {
  switch (ratio) {
    case 'portrait':
      return '3 / 4';
    case 'landscape':
      return '4 / 3';
    case 'square':
    default:
      return '1 / 1';
  }
}

export function productsPerRowCount(perRow: ProductsPerRow): number {
  const n = Number(perRow);
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 2;
}

export function resolveStoreBehaviorSettings(
  raw: StoreBehaviorSettings | null | undefined
): StoreBehaviorSettings {
  return raw ?? DEFAULT_BEHAVIOR_SETTINGS;
}
