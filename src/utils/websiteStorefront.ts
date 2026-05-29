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
  return slugifyStorefront(product.name || product.id);
}

export function storeBasePath(slug: string, onSubdomain = false): string {
  return onSubdomain ? '' : `/store/${slug}`;
}

export function productPagePath(slug: string, product: ProductWithCatalogueData, onSubdomain = false): string {
  const base = storeBasePath(slug, onSubdomain);
  return `${base}/products/${productHandle(product)}`;
}

export function collectionPagePath(slug: string, onSubdomain = false): string {
  const base = storeBasePath(slug, onSubdomain);
  return `${base}/collections/all`;
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
