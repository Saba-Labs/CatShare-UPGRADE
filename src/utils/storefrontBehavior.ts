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
  type ProductsToShow,
  type StoreBehaviorSettings,
} from '../types/storeBehaviorSettings';

export function resolveListingCatalogueId(
  storeCatalogueId: string | null | undefined
): string {
  return String(storeCatalogueId ?? '').trim();
}

/** @deprecated Use {@link resolveListingCatalogueId} — store.catalogue_id is set via Store Settings. */
export function resolveBehaviorCatalogueId(
  productsToShow: ProductsToShow,
  storeCatalogueId: string,
  catalogues: Catalogue[]
): string {
  void productsToShow;
  void catalogues;
  return resolveListingCatalogueId(storeCatalogueId);
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
      return products.filter((p) => isProductEnabledForCatalogue(p, catalogueId));
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
    case 'shuffled':
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
      }
      return copy;
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

export function resolveStoreBehaviorSettings(
  raw: StoreBehaviorSettings | null | undefined
): StoreBehaviorSettings {
  return raw ?? DEFAULT_BEHAVIOR_SETTINGS;
}
