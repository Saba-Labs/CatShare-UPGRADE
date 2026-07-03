import { createDefaultWebsiteModeConfig } from '../config/homepageBuilderConfig';
import type { HomepageLayout, WebsiteModeConfig, WebsiteCollectionTemplate } from '../types/homepage';
import type { FullProductListSection } from '../types/homepage';
import { normalizeProductCardStyle } from './productCardStyles';

const DEFAULT_LIST_SETTINGS: FullProductListSection['settings'] = {
  showSearch: true,
  showCategoryFilters: true,
  showSort: true,
  viewMode: 'list',
  productImageRatio: 'square',
  showPrice: true,
  showAvailability: true,
  defaultSorting: 'newest',
};

export function findFullProductListSection(
  layout: HomepageLayout | null | undefined
): (FullProductListSection & { id: string }) | null {
  const sections = layout?.websiteConfig?.pages?.home?.sections ?? layout?.sections ?? [];
  const section = sections.find((s) => s.type === 'full-product-list');
  if (section?.type === 'full-product-list') {
    return section as FullProductListSection & { id: string };
  }
  return null;
}

export function findFullProductListSettings(
  layout: HomepageLayout | null | undefined
): FullProductListSection['settings'] {
  return findFullProductListSection(layout)?.settings ?? DEFAULT_LIST_SETTINGS;
}

export function resolveCollectionTemplate(
  websiteConfig?: WebsiteModeConfig | null
): WebsiteCollectionTemplate {
  const defaults = createDefaultWebsiteModeConfig().templates.collection;
  return {
    ...defaults,
    ...(websiteConfig?.templates?.collection || {}),
  };
}

export interface ResolvedCollectionPageSettings {
  columns: 2 | 3 | 4;
  showSearch: boolean;
  showCategoryFilters: boolean;
  showSort: boolean;
  viewMode: 'list' | 'grid';
  cardsStyle: ReturnType<typeof normalizeProductCardStyle>;
  productImageRatio: 'square' | 'portrait' | 'landscape';
  showPrice: boolean;
  showAvailability: boolean;
  defaultSorting: FullProductListSection['settings']['defaultSorting'];
}

/** Built-in store / category catalog — settings from websiteConfig.templates.collection. */
export function resolveCollectionPageSettings(
  layout?: HomepageLayout | null
): ResolvedCollectionPageSettings {
  const template = resolveCollectionTemplate(layout?.websiteConfig ?? null);

  return {
    columns: template.columns ?? 4,
    showSearch: template.showSearch ?? true,
    showCategoryFilters: template.showFilters ?? true,
    showSort: template.showSort ?? true,
    viewMode: template.viewMode ?? 'list',
    cardsStyle: normalizeProductCardStyle(template.cardsStyle),
    productImageRatio: template.productImageRatio ?? 'square',
    showPrice: template.showPrice ?? true,
    showAvailability: template.showAvailability ?? true,
    defaultSorting: template.defaultSorting ?? 'newest',
  };
}
