import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import type { StorePublic } from '../services/storeService';
import { getCatalogueData } from '../config/catalogueProductUtils';
import { getProductImageUrls, getPrimaryImageIndex } from '../utils/productImages';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { buildStorefrontUrl } from './storefrontDomain';

export function slugifyStorefront(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function productHandle(product: ProductWithCatalogueData): string {
  const nameSlug = slugifyStorefront(product.name || '');
  const id = String(product.id ?? '').trim();
  if (!id) return nameSlug || 'product';
  const idSlug = slugifyStorefront(id);
  // Name slug alone collides when products share similar titles; id suffix keeps URLs unique.
  return nameSlug ? `${nameSlug}--${idSlug}` : idSlug;
}

/** Passed on in-app product navigation so the correct row opens even if handles collide. */
export type StoreProductNavState = {
  storeProductId?: string;
};

export function legacyProductNameHandle(product: ProductWithCatalogueData): string {
  return slugifyStorefront(product.name || product.id);
}

/** Product slug from `/store/:slug/products/:handle` or subdomain `/products/:handle`. */
export function parseStorefrontProductHandle(pathname: string, onSubdomain = false): string | null {
  const pageSegments = storefrontPageSegments(pathname, onSubdomain);
  if (pageSegments[0] !== 'products') return null;
  const handle = pageSegments[1];
  if (!handle) return null;
  try {
    return decodeURIComponent(handle);
  } catch {
    return handle;
  }
}

export type StorefrontCheckoutRoute = 'details' | 'review';

/** Path segments after store slug (or subdomain root), e.g. `['checkout', 'details']`. */
export function storefrontPageSegments(pathname: string, onSubdomain = false): string[] {
  const segments = pathname.split('/').filter(Boolean);
  const storeSlugIndex = segments.findIndex((s) => s === 'store');
  return storeSlugIndex >= 0 ? segments.slice(storeSlugIndex + 2) : onSubdomain ? segments : [];
}

/** Checkout step from `/store/:slug/checkout/details` or `.../checkout/review`. */
export function parseStorefrontCheckoutRoute(
  pathname: string,
  onSubdomain = false
): StorefrontCheckoutRoute | null {
  const pageSegments = storefrontPageSegments(pathname, onSubdomain);
  if (pageSegments[0] !== 'checkout') return null;
  const step = pageSegments[1];
  if (step === 'details') return 'details';
  if (step === 'review') return 'review';
  return null;
}

export function isStorefrontCheckoutPath(pathname: string, onSubdomain = false): boolean {
  return parseStorefrontCheckoutRoute(pathname, onSubdomain) != null;
}

export function findProductByHandle(
  products: ProductWithCatalogueData[],
  handle: string
): ProductWithCatalogueData | null {
  const normalized = handle.toLowerCase();
  const exact = products.find((p) => productHandle(p).toLowerCase() === normalized);
  if (exact) return exact;

  if (normalized.includes('--')) {
    const idSlug = normalized.split('--').pop() || '';
    const byIdSlug = products.find((p) => slugifyStorefront(String(p.id)).toLowerCase() === idSlug);
    if (byIdSlug) return byIdSlug;
  }

  // Legacy share links that used name-only slugs (only when unambiguous).
  const legacyMatches = products.filter(
    (p) => legacyProductNameHandle(p).toLowerCase() === normalized
  );
  if (legacyMatches.length === 1) return legacyMatches[0];

  return null;
}

export function findProductById(
  products: ProductWithCatalogueData[],
  productId: string
): ProductWithCatalogueData | null {
  const id = productId.trim();
  if (!id) return null;
  return products.find((p) => p.id === id) ?? null;
}

/** Home route for navigate/Link — always a valid router path (never empty). */
export function storeBasePath(slug: string, onSubdomain = false): string {
  return onSubdomain ? '/' : `/store/${slug}`;
}

/**
 * Whether Back/Done can pop in-app history instead of replacing the URL with the store home.
 * False on direct/refresh loads so we do not send users to an external referrer.
 */
export function canPopStorefrontHistory(locationKey: string | undefined): boolean {
  if (!locationKey || locationKey === 'default') return false;
  return typeof window !== 'undefined' && window.history.length > 1;
}

/** Prefix for building nested storefront paths (product, collection, etc.). */
function storePathPrefix(slug: string, onSubdomain: boolean): string {
  return onSubdomain ? '' : `/store/${slug}`;
}

export function productPagePath(slug: string, product: ProductWithCatalogueData, onSubdomain = false): string {
  const prefix = storePathPrefix(slug, onSubdomain);
  return `${prefix}/products/${encodeURIComponent(productHandle(product))}`;
}

export function collectionPagePath(slug: string, onSubdomain = false): string {
  return `${storePathPrefix(slug, onSubdomain)}/collections/all`;
}

export function collectionCategoryPagePath(
  slug: string,
  categoryId: string,
  onSubdomain = false
): string {
  const base = collectionPagePath(slug, onSubdomain);
  const id = String(categoryId).trim();
  if (!id) return base;
  return `${base}?category=${encodeURIComponent(id)}`;
}

/** True when pathname is a storefront collection listing route. */
export function parseStorefrontCollectionRoute(pathname: string, onSubdomain = false): boolean {
  const pageSegments = storefrontPageSegments(pathname, onSubdomain);
  return pageSegments[0] === 'collections';
}

export function checkoutDetailsPath(slug: string, onSubdomain = false): string {
  return `${storePathPrefix(slug, onSubdomain)}/checkout/details`;
}

export function checkoutReviewPath(slug: string, onSubdomain = false): string {
  return `${storePathPrefix(slug, onSubdomain)}/checkout/review`;
}

export function absoluteStoreUrl(slug: string, path: string): string {
  const root = buildStorefrontUrl(slug).replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/') return `${root}/`;
  return `${root}${normalized}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function currencySymbolFor(code?: string | null): string {
  if (!code) return '₹';
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOLS[upper] || `${upper} `;
}

/** Public storefront WhatsApp from RPC or stores.store_whatsapp. */
export function resolveStoreWhatsapp(store: Pick<StorePublic, 'whatsapp' | 'storeWhatsapp'>): string {
  const w = store.whatsapp?.trim() || store.storeWhatsapp?.trim();
  if (!w) return '';
  const digits = w.replace(/\D/g, '');
  return digits.length > 0 ? digits : '';
}

export function formatStorePrice(amount: number, currencyCode?: string | null): string {
  const sym = currencySymbolFor(currencyCode);
  return `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Simple storefront price from catalogue row or top-level price1. */
export function getWebsiteProductPrice(
  product: ProductWithCatalogueData,
  catalogueId?: string | null
): number | null {
  const fromCat = catalogueId ? getCatalogueData(product, catalogueId) : null;
  const raw =
    (fromCat && (fromCat as Record<string, unknown>).price1) ||
    product.price1 ||
    (product as Record<string, unknown>).price;
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getWebsiteProductImageUrl(product: ProductWithCatalogueData): string | undefined {
  const urls = getProductImageUrls(product);
  const idx = getPrimaryImageIndex(product);
  const raw = urls[idx] || urls[0];
  if (!raw || typeof raw !== 'string') return undefined;
  if (raw.startsWith('data:image/')) return raw;
  const ver = (product as Record<string, unknown>).imageVersion;
  const version = typeof ver === 'number' && Number.isFinite(ver) ? ver : undefined;
  return productImageDisplayUrl(raw, version);
}

export interface WhatsAppOrderDetails {
  storeName?: string;
  quantity?: number;
  /** Selected variant options, e.g. { Size: 'M', Color: 'Blue' }. */
  variants?: Record<string, string>;
  price?: number | null;
  currencyCode?: string | null;
}

export function buildWhatsAppProductLink(
  whatsapp: string,
  productName: string,
  details: WhatsAppOrderDetails | string = {}
): string {
  const digits = whatsapp.replace(/\D/g, '');
  // Back-compat: a string third arg used to be the store name.
  const opts: WhatsAppOrderDetails = typeof details === 'string' ? { storeName: details } : details;
  const lines: string[] = [`Hi${opts.storeName ? ` ${opts.storeName}` : ''}, I'd like to order:`, `• ${productName}`];
  if (opts.variants) {
    const variantText = Object.entries(opts.variants)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (variantText) lines.push(`  (${variantText})`);
  }
  if (opts.quantity && opts.quantity > 1) lines.push(`Quantity: ${opts.quantity}`);
  if (opts.price != null) {
    const unit = formatStorePrice(opts.price, opts.currencyCode);
    const qty = opts.quantity && opts.quantity > 0 ? opts.quantity : 1;
    lines.push(`Price: ${unit}${qty > 1 ? ` x ${qty} = ${formatStorePrice(opts.price * qty, opts.currencyCode)}` : ''}`);
  }
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${digits}?text=${text}`;
}
