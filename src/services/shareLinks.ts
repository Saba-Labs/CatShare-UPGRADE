import { getSupabaseClient, supabase } from '../supabaseClient';
import { getAllFields } from '../config/fieldConfig';

function randomToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type ShareLinkItem = {
  productId: string;
  name: string;
  price?: string | number;
  priceUnit?: string;
  imageUrl?: string;
  field1?: string;  field1Label?: string;
  field2?: string;  field2Label?: string;
  field3?: string;  field3Label?: string;
  field4?: string;  field4Label?: string;
  field5?: string;  field5Label?: string;
  field6?: string;  field6Label?: string;
  field7?: string;  field7Label?: string;
  field8?: string;  field8Label?: string;
  field9?: string;  field9Label?: string;
  field10?: string; field10Label?: string;
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

  const item: ShareLinkItem = {
    productId: product.id,
    name: product.name || '',
    imageUrl: product.imageUrl || undefined,
    price: price !== undefined && price !== '' ? String(price) : undefined,
    priceUnit: priceUnit && priceUnit !== 'None' ? priceUnit : undefined,
  };

  // Map all enabled fields with their labels
  enabledFields.forEach((field) => {
    const n = field.key.replace('field', ''); // '1' through '10'
    const val = catData[field.key] ?? product[field.key];
    const unitKey = `${field.key}Unit`;
    const unitVal = catData[unitKey] ?? product[unitKey];

    if (val !== undefined && val !== null && val !== '') {
      (item as any)[`field${n}`] = String(val);
      // Use field label; append unit if present and not "None"
      const unit = unitVal && unitVal !== 'None' ? ` (${unitVal})` : '';
      (item as any)[`field${n}Label`] = `${field.label}${unit}`;
    }
  });

  return item;
}

export async function createShareLink(options: {
  sellerUserId: string;
  sellerWhatsapp: string;
  items: ShareLinkItem[];
  expiresInDays?: number;
}): Promise<{ token: string; url: string }> {
  const token = randomToken(24);
  const expiresInDays = options.expiresInDays ?? 7;
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const baseUrl =
    (import.meta as any).env?.VITE_PUBLIC_WEB_BASE_URL ||
    window.location.origin;

  const { error } = await getSupabaseClient()
    .from('share_links')
    .insert({
      token,
      seller_user_id: options.sellerUserId,
      seller_whatsapp: options.sellerWhatsapp,
      items: options.items,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { token, url: `${baseUrl.replace(/\/+$/, '')}/o/${token}` };
}

export async function fetchShareLinkForCustomer(token: string): Promise<{
  sellerWhatsapp: string;
  items: ShareLinkItem[];
} | null> {
  const { data, error } = await supabase.rpc('get_share_link', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as { sellerWhatsapp: string; items: ShareLinkItem[] };
}