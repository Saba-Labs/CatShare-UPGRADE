import { getSupabaseClient, supabase } from '../supabaseClient';
import { normalizeCheckoutSettings, type StoreCheckoutSettings } from '../types/checkoutSettings';
import {
  normalizeStoreIntegrationFlags,
  type StoreIntegrationFlags,
} from '../types/storeIntegrationFlags';
import { getAllFields, isFieldVisibleOnSurface } from '../config/fieldConfig';
import { getCatalogueData, normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import {
  getSlabUnitPrice,
  normalizeMinimumOrderQuantity,
  normalizeQuantitySlabs,
  resolveQuantityAwarePricing,
  type QuantityPriceSlab,
} from '../utils/quantityPricingUtils';
import { getCurrencyData } from '../utils/currencyUtils';
import { getPublicWebBaseUrl } from '../utils/publicWebBaseUrl';
import {
  getProductImageUrls,
  getPrimaryImageIndex,
  getProductPrimaryImageUrl,
  getProductPrimaryImageVersion,
} from '../utils/productImages';
import { getProductVideoUrls } from '../utils/productGallery';
import { getProductVariantGroups } from '../utils/productVariants';
import type { ProductVariantGroup } from '../utils/productVariants';

/** PostgREST / Supabase when a column is not in the live schema cache. */
function isLikelyMissingCurrencyColumnsError(err: { message?: string; code?: string }): boolean {
  const m = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === 'PGRST204') return true;
  if (
    m.includes('seller_currency') &&
    (m.includes('column') || m.includes('schema cache') || m.includes('could not find'))
  ) {
    return true;
  }
  return false;
}

function isLikelyMissingSellerLogoColumnError(err: { message?: string; code?: string }): boolean {
  const m = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === 'PGRST204' && m.includes('seller_logo')) return true;
  if (
    m.includes('seller_logo') &&
    (m.includes('column') || m.includes('schema cache') || m.includes('could not find'))
  ) {
    return true;
  }
  return false;
}

function randomToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeShareLinkCategories(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return Array.from(
    new Set(
      list
        .map((category) => String(category).trim())
        .filter(Boolean)
    )
  );
}

export type ShareLinkItem = {
  productId: string;
  name: string;
  /** Model / secondary line under the name (from product subtitle). */
  subtitle?: string;
  price?: string | number;
  priceUnit?: string;
  imageUrl?: string;
  imageVersion?: number;
  /** Full gallery for public order form (max 5). */
  imageUrls?: string[];
  /** Hosted video URLs for gallery (YouTube, Vimeo, direct links). */
  videoUrls?: string[];
  primaryImageIndex?: number;
  category?: string[];
  field1?: string;  field1Label?: string;  field1Unit?: string;
  field2?: string;  field2Label?: string;  field2Unit?: string;
  field3?: string;  field3Label?: string;  field3Unit?: string;
  field4?: string;  field4Label?: string;  field4Unit?: string;
  field5?: string;  field5Label?: string;  field5Unit?: string;
  field6?: string;  field6Label?: string;  field6Unit?: string;
  field7?: string;  field7Label?: string;  field7Unit?: string;
  field8?: string;  field8Label?: string;  field8Unit?: string;
  field9?: string;  field9Label?: string;  field9Unit?: string;
  field10?: string; field10Label?: string; field10Unit?: string;
  /** When >1, order qty must be multiples (e.g. 12 for dozens). Omitted = 1 (any qty). */
  quantityStep?: number;
  /** Minimum order qty per line (1 = no extra minimum beyond qty step). */
  minimumOrderQuantity?: number;
  /** Tiered unit prices by quantity. Overrides base price when qty matches a slab. */
  quantitySlabs?: QuantityPriceSlab[];
  /** Size / colour / custom option groups for this product. */
  variantGroups?: ProductVariantGroup[];
};

function parseShareLinkItemPrice(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Unit price for a line item at the given quantity (slab-aware). */
export function getShareLinkItemUnitPrice(item: ShareLinkItem, quantity: number): number {
  const slabs = normalizeQuantitySlabs(item.quantitySlabs);
  if (slabs.length > 0 && quantity > 0) {
    const slabPrice = getSlabUnitPrice(slabs, quantity);
    if (slabPrice != null) return slabPrice;
  }
  if (slabs.length > 0 && quantity <= 0) {
    const display = slabs[0]?.price;
    if (display != null && display > 0) return display;
  }
  return parseShareLinkItemPrice(item.price);
}

// Converts a raw product object into a ShareLinkItem, pulling all enabled fields
export function productToShareLinkItem(
  product: Record<string, any>,
  catalogueId = 'cat1'
): ShareLinkItem {
  const enabledFields = getAllFields().filter(
    (f) => f.enabled && f.key.startsWith('field') && isFieldVisibleOnSurface(f, 'orderLink')
  );

  // Get catalogue-specific data if available
  const catData = product?.catalogueData?.[catalogueId] || {};

  // Resolve price from catalogue data or top-level
  const priceFieldMap: Record<string, string> = {
    cat1: 'price1', cat2: 'price2', cat3: 'price3',
  };
  const priceUnitFieldMap: Record<string, string> = {
    cat1: 'price1Unit', cat2: 'price2Unit', cat3: 'price3Unit',
  };
  const priceField = priceFieldMap[catalogueId] || 'price1';
  const priceUnitField = priceUnitFieldMap[catalogueId] || 'price1Unit';

  const catRow = getCatalogueData(product as never, catalogueId);
  const pricing = resolveQuantityAwarePricing(catRow, priceField, product, 0);
  const effectivePrice =
    pricing.effectiveUnitPrice > 0 ? pricing.effectiveUnitPrice : undefined;

  const priceUnit =
    catData[priceUnitField] ??
    product[priceUnitField] ??
    catData['price1Unit'] ??
    product['price1Unit'] ??
    undefined;

  const step = normalizeOrderQuantityStep(catData.orderQuantityStep);
  const moq = normalizeMinimumOrderQuantity(catData.minimumOrderQuantity);
  const slabs = normalizeQuantitySlabs(catData.quantitySlabs);

  const categories = normalizeShareLinkCategories(catData.category ?? product.category);
  const subtitleRaw = catData.subtitle ?? product.subtitle;
  const subtitle =
    subtitleRaw !== undefined && subtitleRaw !== null && String(subtitleRaw).trim() !== ''
      ? String(subtitleRaw).trim()
      : undefined;

  const galleryUrls = getProductImageUrls(product);
  const galleryVideos = getProductVideoUrls(product);
  const primaryIx = getPrimaryImageIndex(product);
  const variantGroups = getProductVariantGroups(product);

  const item: ShareLinkItem = {
    productId: product.id,
    name: product.name || '',
    ...(subtitle ? { subtitle } : {}),
    ...(categories.length > 0 ? { category: categories } : {}),
    imageUrl: getProductPrimaryImageUrl(product) || product.imageUrl || undefined,
    ...(typeof product.imageVersion === 'number' && Number.isFinite(product.imageVersion)
      ? { imageVersion: product.imageVersion }
      : getProductPrimaryImageVersion(product) != null
        ? { imageVersion: getProductPrimaryImageVersion(product) }
        : {}),
    ...(galleryUrls.length > 0 ? { imageUrls: galleryUrls } : {}),
    ...(galleryVideos.length > 0 ? { videoUrls: galleryVideos } : {}),
    ...(galleryUrls.length > 0 ? { primaryImageIndex: primaryIx } : {}),
    price: effectivePrice !== undefined ? String(effectivePrice) : undefined,
    priceUnit: priceUnit && priceUnit !== 'None' ? priceUnit : undefined,
    ...(step > 1 ? { quantityStep: step } : {}),
    ...(moq > 1 ? { minimumOrderQuantity: moq } : {}),
    ...(slabs.length > 0 ? { quantitySlabs: slabs } : {}),
    ...(variantGroups.length > 0 ? { variantGroups } : {}),
  };

  // Map all enabled fields with their labels
  enabledFields.forEach((field) => {
    const n = field.key.replace('field', ''); // '1' through '10'
    const val = catData[field.key] ?? product[field.key];
    const unitKey = `${field.key}Unit`;
    const unitVal = catData[unitKey] ?? product[unitKey];

    if (val !== undefined && val !== null && val !== '') {
      (item as any)[`field${n}`] = String(val);
      // Label = field name only; unit stored separately for order form (value + unit on the right)
      (item as any)[`field${n}Label`] = field.label;
      if (unitVal && unitVal !== 'None') {
        (item as any)[`field${n}Unit`] = String(unitVal);
      }
    }
  });

  return item;
}

/** Presets for catalogue “share as link” (order form). Values are days for `expires_at` (48h = 2 days). */
export const SHARE_LINK_EXPIRY_PRESETS = [
  { id: '24h' as const, label: '24 hours', expiresInDays: 1 },
  { id: '48h' as const, label: '48 hours', expiresInDays: 2 },
  { id: '4d' as const, label: '4 days', expiresInDays: 4 },
  { id: '7d' as const, label: '7 days', expiresInDays: 7 },
] as const;

export type ShareLinkExpiryPresetId = (typeof SHARE_LINK_EXPIRY_PRESETS)[number]['id'];

export async function createShareLink(options: {
  sellerUserId: string;
  sellerWhatsapp: string;
  items: ShareLinkItem[];
  /** Shown in customer order form header (Account → Business details). */
  sellerBusinessName?: string;
  /** ISO currency code (e.g. INR) — from app Currency settings when link is created. */
  sellerCurrencyCode?: string;
  /** Display symbol (e.g. ₹) — includes custom currency symbols from settings. */
  sellerCurrencySymbol?: string;
  /** Business logo URL (Account → business details). */
  sellerLogoUrl?: string;
  /** Default 1 day (24h). Use `SHARE_LINK_EXPIRY_PRESETS` for UI. */
  expiresInDays?: number;
}): Promise<{ token: string; url: string }> {
  const token = randomToken(16);
  const expiresInDays = options.expiresInDays ?? 1;
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const baseUrl = getPublicWebBaseUrl();

  const trimmedName = options.sellerBusinessName?.trim();
  const code = (options.sellerCurrencyCode || 'INR').trim() || 'INR';
  const sym =
    (options.sellerCurrencySymbol || '').trim() || getCurrencyData(code).symbol;
  const trimmedLogo = (options.sellerLogoUrl || '').trim();

  const baseRow: Record<string, unknown> = {
    token,
    seller_user_id: options.sellerUserId,
    seller_whatsapp: options.sellerWhatsapp,
    items: options.items,
    expires_at: expiresAt,
    ...(trimmedName ? { seller_business_name: trimmedName } : {}),
  };

  const rowWithCurrency = {
    ...baseRow,
    seller_currency_code: code,
    seller_currency_symbol: sym,
  };

  const rowWithMeta =
    trimmedLogo.length > 0
      ? { ...rowWithCurrency, seller_logo_url: trimmedLogo }
      : rowWithCurrency;

  const client = getSupabaseClient();
  let { error } = await client.from('share_links').insert(rowWithMeta);

  // DB without seller_logo_url column
  if (error && trimmedLogo.length > 0 && isLikelyMissingSellerLogoColumnError(error)) {
    ({ error } = await client.from('share_links').insert(rowWithCurrency));
    if (!error && trimmedLogo.length > 0) {
      const { error: logoUpdErr } = await client
        .from('share_links')
        .update({ seller_logo_url: trimmedLogo })
        .eq('token', token);
      if (logoUpdErr && !isLikelyMissingSellerLogoColumnError(logoUpdErr)) {
        console.warn('[share_links] Could not persist seller logo:', logoUpdErr.message);
      }
    }
  }

  // Older DBs may not have currency columns yet — retry without them so link creation still works.
  // If columns exist with DEFAULT INR/₹, omitting them would store wrong currency; fix with UPDATE below.
  let usedFallbackInsertWithoutCurrency = false;
  if (error && isLikelyMissingCurrencyColumnsError(error)) {
    ({ error } = await client.from('share_links').insert(baseRow));
    usedFallbackInsertWithoutCurrency = !error;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (usedFallbackInsertWithoutCurrency) {
    const { error: updErr } = await client
      .from('share_links')
      .update({
        seller_currency_code: code,
        seller_currency_symbol: sym,
        ...(trimmedLogo.length > 0 ? { seller_logo_url: trimmedLogo } : {}),
      })
      .eq('token', token);
    if (updErr && !isLikelyMissingCurrencyColumnsError(updErr)) {
      console.warn('[share_links] Could not persist seller currency/logo after fallback insert:', updErr.message);
    }
  }

  return { token, url: `${baseUrl.replace(/\/+$/, '')}/o/${token}` };
}

export type ShareLinkForCustomer = {
  sellerWhatsapp: string;
  items: ShareLinkItem[];
  sellerBusinessName?: string;
  sellerCurrencyCode?: string;
  sellerCurrencySymbol?: string;
  /** Present when RPC merges `user_settings.data.customCurrencies` (see SUPABASE_SHARE_LINKS_SQL.md). */
  sellerCustomCurrencies?: Record<string, string> | null;
  /** Business logo URL (Account); RPC merges `user_settings.data.businessProfile.logoUrl`. */
  sellerLogoUrl?: string;
};

export type SellerCheckoutFeatures = {
  integrationFlags: StoreIntegrationFlags;
  checkoutSettings: StoreCheckoutSettings;
};

export async function fetchSellerCheckoutFeatures(
  sellerUserId: string
): Promise<SellerCheckoutFeatures> {
  const defaults: SellerCheckoutFeatures = {
    integrationFlags: normalizeStoreIntegrationFlags(null),
    checkoutSettings: normalizeCheckoutSettings(null),
  };
  if (!sellerUserId?.trim()) return defaults;

  try {
    const { data, error } = await getSupabaseClient().rpc('get_seller_checkout_features', {
      p_seller_user_id: sellerUserId.trim(),
    });
    if (error) {
      console.warn('[fetchSellerCheckoutFeatures]', error.message);
      return defaults;
    }
    let parsed: unknown = data;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return defaults;
      }
    }
    const row = (parsed ?? {}) as Record<string, unknown>;
    return {
      integrationFlags: normalizeStoreIntegrationFlags(
        row.integrationFlags ?? row.integration_flags
      ),
      checkoutSettings: normalizeCheckoutSettings(
        row.checkoutSettings ?? row.checkout_settings
      ),
    };
  } catch (e) {
    console.warn('[fetchSellerCheckoutFeatures]', e);
    return defaults;
  }
}

export async function fetchShareLinkForCustomer(token: string): Promise<ShareLinkForCustomer | null> {
  const { data, error } = await supabase.rpc('get_share_link', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const rawCustom = row.sellerCustomCurrencies;
  let sellerCustomCurrencies: Record<string, string> | undefined;
  if (rawCustom != null && typeof rawCustom === 'object' && !Array.isArray(rawCustom)) {
    sellerCustomCurrencies = rawCustom as Record<string, string>;
  }
  return {
    ...(data as ShareLinkForCustomer),
    sellerCustomCurrencies,
  };
}

export async function fetchSellerUserIdForToken(token: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_seller_user_id', {
      p_token: token,
    });
    if (error) {
      console.warn('Failed to fetch seller user ID:', error.message);
      return null;
    }
    return data as string | null;
  } catch (err) {
    console.warn('Error fetching seller user ID:', err);
    return null;
  }
}
