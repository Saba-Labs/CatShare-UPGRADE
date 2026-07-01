import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import { generateOrderTrackingToken, isLikelyMissingTrackingColumnsError } from './orderTrackingService';
import type { OrderStatus } from '../types/orderStatus';
import type { CheckoutTotals } from '../types/checkoutSettings';
import { applyOrderInventory, restoreOrderInventory } from './inventoryService';

function isMissingStorefrontOrderRpc(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  const code = String((error as { code?: string })?.code ?? '');
  return (
    code === 'PGRST202' ||
    msg.includes('create_storefront_order') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

function shouldFallbackFromStoreRpc(error: unknown): boolean {
  if (!error) return false;
  if (isMissingStorefrontOrderRpc(error)) return true;
  const code = String((error as { code?: string })?.code ?? '');
  const msg = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  if (code === '42501' || code === 'PGRST301' || msg.includes('permission denied')) return true;
  if (msg.includes('invalid order response')) return true;
  return false;
}

function parseStorefrontOrderRpcData(data: unknown): Order | null {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return normalizeOrderRow(data as Record<string, unknown>);
  }
  if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object') {
    return normalizeOrderRow(data[0] as Record<string, unknown>);
  }
  return null;
}

function normalizeOrderRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id ?? ''),
    share_link_token: String(row.share_link_token ?? ''),
    seller_user_id: String(row.seller_user_id ?? ''),
    customer_name: String(row.customer_name ?? ''),
    customer_whatsapp: row.customer_whatsapp != null ? String(row.customer_whatsapp) : undefined,
    items: Array.isArray(row.items) ? (row.items as OrderItem[]) : [],
    total_amount: row.total_amount != null ? Number(row.total_amount) : undefined,
    currency_code: String(row.currency_code ?? 'INR'),
    status: (row.status as Order['status']) ?? 'pending',
    order_source: row.order_source as Order['order_source'],
    tracking_token: row.tracking_token != null ? String(row.tracking_token) : undefined,
    store_slug: row.store_slug != null ? String(row.store_slug) : undefined,
    customer_edited_at: row.customer_edited_at != null ? String(row.customer_edited_at) : undefined,
    payment_method: row.payment_method as Order['payment_method'],
    checkout_adjustments: (row.checkout_adjustments as CheckoutTotals | null) ?? null,
    shipping_address: (row.shipping_address as Order['shipping_address']) ?? null,
    catalogue_id: row.catalogue_id != null ? String(row.catalogue_id) : undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/** User-facing message for storefront order failures. */
export function formatStoreOrderError(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  const code = String((error as { code?: string })?.code ?? '');
  if (msg.includes('insufficient_stock')) {
    return 'Some items are no longer in stock. Please review your cart and try again.';
  }
  if (msg.includes('items_required') || msg.includes('items') && msg.includes('empty')) {
    return 'Your cart is empty. Add items before placing the order.';
  }
  if (code === '42501' || msg.includes('row-level security')) {
    return 'Could not save your order (permissions). Run sql/create_storefront_order.sql in Supabase, then try again.';
  }
  if (code === 'PGRST116' || msg.includes('0 rows')) {
    return 'Order may not have saved correctly. Please check your orders list before trying again.';
  }
  if (msg.includes('seller_required') || msg.includes('customer_name_required')) {
    return 'Missing order details. Please fill in your name and try again.';
  }
  if (msg.includes('coupon_not_allowed')) {
    const reason = msg.split('coupon_not_allowed:')[1]?.trim() ?? '';
    if (reason.includes('max_uses_reached')) {
      return 'This coupon has reached its usage limit.';
    }
    if (reason.includes('already_used_by_phone')) {
      return 'You have already used this coupon.';
    }
    if (reason.includes('phone_required')) {
      return 'Enter your WhatsApp number to use this coupon.';
    }
    if (reason.includes('category_mismatch') || reason.includes('product_mismatch')) {
      return 'This coupon does not apply to items in your cart.';
    }
    if (reason.includes('coupon_expired')) {
      return 'This coupon has expired.';
    }
    return 'This coupon cannot be applied to your order.';
  }
  const detail = String((error as { message?: string })?.message ?? '').trim();
  if (detail && import.meta.env.DEV) {
    return `Failed to place order: ${detail}`;
  }
  return 'Failed to place order. Please try again.';
}

async function insertStoreOrderViaRpc(
  trimmedSeller: string,
  storeSlug: string | undefined,
  storeShareToken: string,
  customerName: string,
  customerWhatsapp: string | undefined,
  items: OrderItem[],
  totalAmount: number | undefined,
  currencyCode: string,
  trackingToken: string,
  checkoutExtras?: {
    paymentMethod?: 'prepaid' | 'cod' | 'upi' | 'manual';
    checkoutAdjustments?: CheckoutTotals;
    shippingAddress?: Order['shipping_address'];
  }
): Promise<{ data: Order | null; error: unknown }> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('create_storefront_order', {
    p_seller_user_id: trimmedSeller,
    p_store_slug: storeSlug?.trim().toLowerCase() ?? '',
    p_share_link_token: storeShareToken,
    p_customer_name: customerName,
    p_customer_whatsapp: customerWhatsapp ?? '',
    p_items: items,
    p_total_amount: totalAmount ?? null,
    p_currency_code: currencyCode,
    p_tracking_token: trackingToken,
    p_payment_method: checkoutExtras?.paymentMethod ?? null,
    p_checkout_adjustments: checkoutExtras?.checkoutAdjustments ?? null,
    p_shipping_address: checkoutExtras?.shippingAddress ?? null,
  });

  if (error) {
    return { data: null, error };
  }

  const parsed = parseStorefrontOrderRpcData(data);
  if (parsed) {
    return { data: parsed, error: null };
  }

  return { data: null, error: new Error('Invalid order response') };
}

async function insertOrderRow(
  client: ReturnType<typeof getSupabaseClient>,
  baseRow: Record<string, unknown>
): Promise<{ data: Order | null; error: unknown }> {
  const row = { ...baseRow };
  const now = new Date().toISOString();

  const tryInsert = async () => client.from('orders').insert(row);

  let insertResult = await tryInsert();
  let error = insertResult.error;

  if (error && isLikelyMissingTrackingColumnsError(error as { message?: string; code?: string })) {
    delete row.tracking_token;
    delete row.store_slug;
    insertResult = await tryInsert();
    error = insertResult.error;
  }

  if (
    error &&
    (String((error as { message?: string }).message || '').includes('checkout_adjustments') ||
      String((error as { message?: string }).message || '').includes('payment_method'))
  ) {
    delete row.checkout_adjustments;
    delete row.payment_method;
    insertResult = await tryInsert();
    error = insertResult.error;
  }

  if (error && String((error as { message?: string }).message || '').includes('shipping_address')) {
    delete row.shipping_address;
    insertResult = await tryInsert();
    error = insertResult.error;
  }

  if (error) {
    return { data: null, error };
  }

  return {
    data: normalizeOrderRow({
      ...row,
      created_at: now,
      updated_at: now,
    }),
    error: null,
  };
}

async function applyStoreOrderInventoryBestEffort(orderId: string): Promise<void> {
  try {
    const inv = await applyOrderInventory(orderId);
    if (inv.error) {
      console.warn('[createOrder] Inventory apply error (order kept):', inv.error);
      return;
    }
    const invPayload = inv.data as { applied?: boolean; reason?: string } | null;
    if (invPayload?.applied === false) {
      console.warn('[createOrder] Inventory not applied (order kept):', invPayload.reason);
    }
  } catch (e) {
    console.warn('[createOrder] Inventory apply threw (order kept):', e);
  }
}

/** Orders RLS (see SUPABASE_ORDERS_SQL.md) uses `x-user-id`. Restore from session before seller mutations when header was cleared (e.g. after StoreView order). */
async function ensureOrdersRlsHeaderFromSession(): Promise<void> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (session?.user?.id) setSupabaseRlsUserId(session.user.id);
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  rowTotal: number;
  category?: string;
  /** All category labels on the product (for coupon restrictions) */
  categories?: string[];
  subtitle?: string;
  priceUnit?: string;
  imageUrl?: string;
  /** Bumps when product image changes — cache bust for CDN/browser */
  imageVersion?: number;
  quantityStep?: number;
  /** e.g. "Size: L; Colour: Red" */
  variantSummary?: string;
  /** Stable variant line id for warehouse deduction */
  variantCombinationId?: string;
}

export interface Order {
  id: string;
  share_link_token: string;
  seller_user_id: string;
  customer_name: string;
  customer_whatsapp?: string;
  items: OrderItem[];
  total_amount?: number;
  currency_code: string;
  status: OrderStatus;
  order_source?: 'link' | 'manual' | 'store';
  tracking_token?: string;
  store_slug?: string;
  customer_edited_at?: string;
  payment_method?: 'prepaid' | 'cod' | 'upi' | 'manual';
  checkout_adjustments?: CheckoutTotals | null;
  shipping_address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  } | null;
  /** Catalogue used when the order was created (manual / seller entry). */
  catalogue_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type { OrderStatus } from '../types/orderStatus';

/**
 * Create a new order from customer confirmation
 */
export async function createOrder(
  sellerUserId: string,
  shareLinkToken: string,
  customerName: string,
  items: OrderItem[],
  totalAmount: number | undefined,
  currencyCode: string = 'INR',
  customerWhatsapp?: string,
  orderSource: 'link' | 'manual' | 'store' = 'link',
  storeSlug?: string,
  checkoutExtras?: {
    paymentMethod?: 'prepaid' | 'cod' | 'upi' | 'manual';
    checkoutAdjustments?: CheckoutTotals;
    shippingAddress?: Order['shipping_address'];
  }
): Promise<{ data: Order | null; error: any }> {
  try {
    const trimmedSeller = String(sellerUserId ?? '').trim();
    if (!trimmedSeller) {
      return { data: null, error: new Error('seller_required') };
    }
    if (!customerName?.trim()) {
      return { data: null, error: new Error('customer_name_required') };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { data: null, error: new Error('items_required') };
    }

    setSupabaseRlsUserId(trimmedSeller);
    const client = getSupabaseClient();
    const trackingToken = generateOrderTrackingToken();

    const storeShareToken =
      orderSource === 'store'
        ? `store:${(storeSlug?.trim() || trimmedSeller || 'order').toLowerCase()}`
        : shareLinkToken;

    let data: Order | null = null;
    let error: unknown = null;

    if (orderSource === 'store') {
      const rpcResult = await insertStoreOrderViaRpc(
        trimmedSeller,
        storeSlug,
        storeShareToken,
        customerName.trim(),
        customerWhatsapp,
        items,
        totalAmount,
        currencyCode,
        trackingToken,
        checkoutExtras
      );
      data = rpcResult.data;
      error = rpcResult.error;

      if (!data && error && shouldFallbackFromStoreRpc(error)) {
        error = null;
      }
    }

    if (!data) {
      const orderId = crypto.randomUUID();
      const row: Record<string, unknown> = {
        id: orderId,
        share_link_token: storeShareToken,
        seller_user_id: trimmedSeller,
        customer_name: customerName.trim(),
        customer_whatsapp: customerWhatsapp,
        items: items,
        total_amount: totalAmount,
        currency_code: currencyCode,
        status: 'pending',
        order_source: orderSource,
        tracking_token: trackingToken,
      };
      if (storeSlug?.trim()) {
        row.store_slug = storeSlug.trim().toLowerCase();
      }
      if (checkoutExtras?.paymentMethod) {
        row.payment_method = checkoutExtras.paymentMethod;
      }
      if (checkoutExtras?.checkoutAdjustments) {
        row.checkout_adjustments = checkoutExtras.checkoutAdjustments;
      }
      if (checkoutExtras?.shippingAddress) {
        row.shipping_address = checkoutExtras.shippingAddress;
      }

      const insertOutcome = await insertOrderRow(client, row);
      data = insertOutcome.data;
      error = insertOutcome.error;
    }

    if (error) {
      return { data: null, error };
    }

    if (data?.id && orderSource === 'store') {
      await applyStoreOrderInventoryBestEffort(String(data.id));
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Create a new order directly (without share link - for manual seller entry)
 */
export async function createOrderDirectly(
  sellerUserId: string,
  customerName: string,
  items: OrderItem[],
  totalAmount: number | undefined,
  currencyCode: string = 'INR',
  customerWhatsapp?: string,
  catalogueId?: string,
  orderSource: 'link' | 'manual' | 'store' = 'manual',
  checkoutAdjustments?: CheckoutTotals | null
): Promise<{ data: Order | null; error: any }> {
  try {
    const client = getSupabaseClient();
    const trackingToken = generateOrderTrackingToken();
    const insertRow: Record<string, unknown> = {
      share_link_token: 'manual-order',
      seller_user_id: sellerUserId,
      customer_name: customerName,
      customer_whatsapp: customerWhatsapp,
      items: items,
      total_amount: checkoutAdjustments?.grandTotal ?? totalAmount,
      currency_code: currencyCode,
      status: 'pending',
      order_source: orderSource,
      tracking_token: trackingToken,
    };

    if (checkoutAdjustments) {
      insertRow.checkout_adjustments = checkoutAdjustments;
    }

    if (catalogueId?.trim()) {
      insertRow.catalogue_id = catalogueId.trim();
    }

    let { data, error } = await client.from('orders').insert(insertRow).select().maybeSingle();

    if (error && isLikelyMissingTrackingColumnsError(error)) {
      delete insertRow.tracking_token;
      ({ data, error } = await client.from('orders').insert(insertRow).select().maybeSingle());
    }

    if (
      error &&
      (String((error as { message?: string }).message || '').includes('checkout_adjustments') ||
        String((error as { message?: string }).message || '').includes('payment_method'))
    ) {
      delete insertRow.checkout_adjustments;
      delete insertRow.payment_method;
      ({ data, error } = await client.from('orders').insert(insertRow).select().maybeSingle());
    }

    if (error && String((error as { message?: string }).message || '').includes('catalogue_id')) {
      delete insertRow.catalogue_id;
      ({ data, error } = await client.from('orders').insert(insertRow).select().maybeSingle());
    }

    return { data: (data as Order | null) ?? null, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export type FetchSellerOrdersOptions = {
  status?: OrderStatus;
  /**
   * Only rows with created_at strictly greater than this ISO timestamp.
   * Use for polling new orders — avoids re-reading the full orders table every tick.
   * Pair with DB index on (seller_user_id, created_at) for best performance.
   */
  createdAfter?: string;
};

/**
 * Fetch orders for a seller (full list or incremental when `createdAfter` is set).
 */
export async function fetchSellerOrders(
  sellerUserId: string,
  options?: FetchSellerOrdersOptions
): Promise<{ data: Order[] | null; error: any }> {
  try {
    // Validate seller user ID is provided and not empty
    if (!sellerUserId || sellerUserId.trim() === '') {
      return {
        data: null,
        error: new Error('Seller user ID is required and cannot be empty')
      };
    }

    // Validate UUID format (roughly: 8-4-4-4-12 hex chars)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sellerUserId)) {
      return {
        data: null,
        error: new Error('Invalid seller user ID format. Guest users cannot access orders.')
      };
    }

    const trimmed = sellerUserId.trim();

    if (!isBrowserOnline()) {
      const cacheKey = getStorageKey('sellerOrders', trimmed);
      let cached = safeGetFromStorage<Order[]>(cacheKey, []);
      if (options?.status) {
        cached = cached.filter((o) => o.status === options.status);
      }
      if (options?.createdAfter?.trim()) {
        const after = options.createdAfter.trim();
        cached = cached.filter((o) => (o.created_at || '') > after);
      }
      const incremental = Boolean(options?.createdAfter?.trim());
      cached = [...cached].sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return incremental ? ta - tb : tb - ta;
      });
      return { data: cached, error: null };
    }

    // RLS matches seller_user_id to x-user-id; customer flows clear the header after insert — restore for seller reads.
    setSupabaseRlsUserId(trimmed);

    const client = getSupabaseClient();
    const incremental = Boolean(options?.createdAfter?.trim());

    let query = client
      .from('orders')
      .select('*')
      .eq('seller_user_id', trimmed)
      .order('created_at', { ascending: incremental });

    if (options?.createdAfter?.trim()) {
      query = query.gt('created_at', options.createdAfter.trim());
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

const MIN_TRACKING_TOKEN_LENGTH = 16;

/** Create or return the secret tracking token stored on the order row. */
export async function ensureOrderTrackingToken(
  sellerUserId: string,
  orderId: string
): Promise<{ token: string | null; error: unknown }> {
  try {
    const trimmedSeller = String(sellerUserId ?? '').trim();
    const trimmedOrderId = String(orderId ?? '').trim();
    if (!trimmedSeller || !trimmedOrderId) {
      return { token: null, error: new Error('Missing seller or order id') };
    }

    setSupabaseRlsUserId(trimmedSeller);
    const client = getSupabaseClient();
    const { data: row, error: readErr } = await client
      .from('orders')
      .select('tracking_token')
      .eq('id', trimmedOrderId)
      .eq('seller_user_id', trimmedSeller)
      .maybeSingle();

    if (readErr) return { token: null, error: readErr };
    if (!row) return { token: null, error: new Error('Order not found') };

    const existing = String(row.tracking_token ?? '').trim();
    if (existing.length >= MIN_TRACKING_TOKEN_LENGTH) {
      return { token: existing, error: null };
    }

    const token = generateOrderTrackingToken();
    const { error: updateErr } = await client
      .from('orders')
      .update({ tracking_token: token, updated_at: new Date().toISOString() })
      .eq('id', trimmedOrderId)
      .eq('seller_user_id', trimmedSeller);

    if (updateErr) return { token: null, error: updateErr };
    return { token, error: null };
  } catch (err) {
    return { token: null, error: err };
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ data: Order | null; error: any }> {
  try {
    await ensureOrdersRlsHeaderFromSession();
    const client = getSupabaseClient();

    const { data: existing } = await client
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    const prevStatus = existing?.status as Order['status'] | undefined;

    const { data, error } = await client
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (!error && status === 'cancelled' && prevStatus && prevStatus !== 'cancelled') {
      await restoreOrderInventory(orderId);
    }

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Update order (items, customer details, total amount)
 */
export async function updateOrder(
  orderId: string,
  updates: {
    items?: OrderItem[];
    customer_name?: string;
    customer_whatsapp?: string;
    total_amount?: number;
    shipping_address?: Order['shipping_address'];
    checkout_adjustments?: CheckoutTotals | null;
  }
): Promise<{ data: Order | null; error: any }> {
  try {
    await ensureOrdersRlsHeaderFromSession();
    const client = getSupabaseClient();

    const row = { ...updates, updated_at: new Date().toISOString() };

    let { data, error } = await client.from('orders').update(row).eq('id', orderId);

    if (
      error &&
      String((error as { message?: string }).message || '').includes('checkout_adjustments')
    ) {
      delete row.checkout_adjustments;
      ({ data, error } = await client.from('orders').update(row).eq('id', orderId));
    }

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Delete an order
 */
export async function deleteOrder(orderId: string): Promise<{ error: any }> {
  try {
    await ensureOrdersRlsHeaderFromSession();
    const client = getSupabaseClient();

    const { error } = await client.from('orders').delete().eq('id', orderId);

    return { error };
  } catch (err) {
    return { error: err };
  }
}
