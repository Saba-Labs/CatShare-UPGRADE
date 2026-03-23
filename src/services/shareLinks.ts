import { getSupabaseClient, supabase } from '../supabaseClient';
import { getAllFields } from '../config/fieldConfig';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { getCurrencyData } from '../utils/currencyUtils';

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

function randomToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type ShareLinkItem = {
  productId: string;
  name: string;
  /** Model / secondary line under the name (from product subtitle). */
  subtitle?: string;
  price?: string | number;
  priceUnit?: string;
  imageUrl?: string;
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
};

// Converts a raw product object into a ShareLinkItem, pulling all enabled fields
export function productToShareLinkItem(
  product: Record<string, any>,
  catalogueId = 'cat1'
): ShareLinkItem {
  const enabledFields = getAllFields().filter(
    (f) => f.enabled && f.key.startsWith('field')
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

  const price =
    catData[priceField] ??
    product[priceField] ??
    catData['price1'] ??
    product['price1'] ??
    undefined;

  const priceUnit =
    catData[priceUnitField] ??
    product[priceUnitField] ??
    catData['price1Unit'] ??
    product['price1Unit'] ??
    undefined;

  const step = normalizeOrderQuantityStep(catData.orderQuantityStep);

  const item: ShareLinkItem = {
    productId: product.id,
    name: product.name || '',
    imageUrl: product.imageUrl || undefined,
    price: price !== undefined && price !== '' ? String(price) : undefined,
    priceUnit: priceUnit && priceUnit !== 'None' ? priceUnit : undefined,
    ...(step > 1 ? { quantityStep: step } : {}),
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
  expiresInDays?: number;
}): Promise<{ token: string; url: string }> {
  const token = randomToken(24);
  const expiresInDays = options.expiresInDays ?? 1;
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const baseUrl =
    (import.meta as any).env?.VITE_PUBLIC_WEB_BASE_URL ||
    'https://catshare.vercel.app';

  const trimmedName = options.sellerBusinessName?.trim();
  const code = (options.sellerCurrencyCode || 'INR').trim() || 'INR';
  const sym =
    (options.sellerCurrencySymbol || '').trim() || getCurrencyData(code).symbol;

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

  const client = getSupabaseClient();
  let { error } = await client.from('share_links').insert(rowWithCurrency);

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
      .update({ seller_currency_code: code, seller_currency_symbol: sym })
      .eq('token', token);
    if (updErr && !isLikelyMissingCurrencyColumnsError(updErr)) {
      console.warn('[share_links] Could not persist seller currency after fallback insert:', updErr.message);
    }
  }

  return { token, url: `${baseUrl.replace(/\/+$/, '')}/o/${token}` };
}

export async function fetchShareLinkForCustomer(token: string): Promise<{
  sellerWhatsapp: string;
  items: ShareLinkItem[];
  sellerBusinessName?: string;
  sellerCurrencyCode?: string;
  sellerCurrencySymbol?: string;
} | null> {
  const { data, error } = await supabase.rpc('get_share_link', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as {
    sellerWhatsapp: string;
    items: ShareLinkItem[];
    sellerBusinessName?: string;
    sellerCurrencyCode?: string;
    sellerCurrencySymbol?: string;
  };
}
