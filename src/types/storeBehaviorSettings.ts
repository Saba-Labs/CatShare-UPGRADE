/**
 * Store behaviour preferences — persisted on `stores.behavior_settings` JSONB.
 * Catalogue/display/customer toggles not stored as first-class columns.
 */

export type ProductsToShow = 'all' | 'wholesale' | 'reseller' | 'featured' | 'category';
export type DefaultSorting = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'alphabetical' | 'shuffled';
export type ProductImageRatio = 'square' | 'portrait' | 'landscape';

export interface StoreBehaviorSettings {
  version: 1;
  productsToShow: ProductsToShow;
  defaultSorting: DefaultSorting;
  productImageRatio: ProductImageRatio;
  showPrice: boolean;
  showAvailability: boolean;
  showCategories: boolean;
  defaultCurrency: string;
  defaultLanguage: string;
  customerNotifications: boolean;
  allowGuestBrowsing: boolean;
  requireLoginBeforeCheckout: boolean;
  timeZone: string;
  businessCountry: string;
  defaultShippingRegion: string;
  debugMode: boolean;
  developerMode: boolean;
}

export const DEFAULT_BEHAVIOR_SETTINGS: StoreBehaviorSettings = {
  version: 1,
  productsToShow: 'all',
  defaultSorting: 'newest',
  productImageRatio: 'square',
  showPrice: true,
  showAvailability: true,
  showCategories: true,
  defaultCurrency: 'INR',
  defaultLanguage: 'en',
  customerNotifications: true,
  allowGuestBrowsing: true,
  requireLoginBeforeCheckout: false,
  timeZone: 'UTC',
  businessCountry: 'IN',
  defaultShippingRegion: 'worldwide',
  debugMode: false,
  developerMode: false,
};

function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

function productsToShow(raw: unknown): ProductsToShow {
  const v = str(raw, 'all');
  if (v === 'wholesale' || v === 'reseller' || v === 'featured' || v === 'category') return v;
  return 'all';
}

function defaultSorting(raw: unknown): DefaultSorting {
  const v = str(raw, 'newest');
  if (v === 'oldest' || v === 'price-low' || v === 'price-high' || v === 'alphabetical' || v === 'shuffled') return v;
  return 'newest';
}

function imageRatio(raw: unknown): ProductImageRatio {
  const v = str(raw, 'square');
  if (v === 'portrait' || v === 'landscape') return v;
  return 'square';
}

export function normalizeBehaviorSettings(raw: unknown): StoreBehaviorSettings {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    version: 1,
    productsToShow: productsToShow(source.productsToShow),
    defaultSorting: defaultSorting(source.defaultSorting),
    productImageRatio: imageRatio(source.productImageRatio),
    showPrice: bool(source.showPrice, DEFAULT_BEHAVIOR_SETTINGS.showPrice),
    showAvailability: bool(source.showAvailability, DEFAULT_BEHAVIOR_SETTINGS.showAvailability),
    showCategories: bool(source.showCategories, DEFAULT_BEHAVIOR_SETTINGS.showCategories),
    defaultCurrency: str(source.defaultCurrency, DEFAULT_BEHAVIOR_SETTINGS.defaultCurrency),
    defaultLanguage: str(source.defaultLanguage, DEFAULT_BEHAVIOR_SETTINGS.defaultLanguage),
    customerNotifications: bool(
      source.customerNotifications,
      DEFAULT_BEHAVIOR_SETTINGS.customerNotifications
    ),
    allowGuestBrowsing: bool(source.allowGuestBrowsing, DEFAULT_BEHAVIOR_SETTINGS.allowGuestBrowsing),
    requireLoginBeforeCheckout: bool(
      source.requireLoginBeforeCheckout,
      DEFAULT_BEHAVIOR_SETTINGS.requireLoginBeforeCheckout
    ),
    timeZone: str(source.timeZone, DEFAULT_BEHAVIOR_SETTINGS.timeZone),
    businessCountry: str(source.businessCountry, DEFAULT_BEHAVIOR_SETTINGS.businessCountry),
    defaultShippingRegion: str(
      source.defaultShippingRegion,
      DEFAULT_BEHAVIOR_SETTINGS.defaultShippingRegion
    ),
    debugMode: bool(source.debugMode, false),
    developerMode: bool(source.developerMode, false),
  };
}

export function behaviorFromStoreSettingsState(state: {
  productsToShow: ProductsToShow;
  defaultSorting: DefaultSorting;
  productImageRatio: ProductImageRatio;
  showPrice: boolean;
  showAvailability: boolean;
  showCategories: boolean;
  defaultCurrency: string;
  defaultLanguage: string;
  customerNotifications: boolean;
  allowGuestBrowsing: boolean;
  requireLoginBeforeCheckout: boolean;
  timeZone: string;
  businessCountry: string;
  defaultShippingRegion: string;
  debugMode: boolean;
  developerMode: boolean;
}): StoreBehaviorSettings {
  return normalizeBehaviorSettings(state);
}
