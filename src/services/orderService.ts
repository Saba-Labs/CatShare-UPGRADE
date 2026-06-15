import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import { generateOrderTrackingToken, isLikelyMissingTrackingColumnsError } from './orderTrackingService';
import type { CheckoutTotals } from '../types/checkoutSettings';
import { applyOrderInventory, restoreOrderInventory } from './inventoryService';

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
  status: 'pending' | 'completed' | 'cancelled';
  order_source?: 'link' | 'manual' | 'store';
  tracking_token?: string;
  store_slug?: string;
  customer_edited_at?: string;
  payment_method?: 'prepaid' | 'cod';
  checkout_adjustments?: CheckoutTotals | null;
  created_at: string;
  updated_at: string;
}

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
    paymentMethod?: 'prepaid' | 'cod';
    checkoutAdjustments?: CheckoutTotals;
  }
): Promise<{ data: Order | null; error: any }> {
  try {
    const client = getSupabaseClient();
    const trackingToken = generateOrderTrackingToken();

    const row: Record<string, unknown> = {
      share_link_token: shareLinkToken,
      seller_user_id: sellerUserId,
      customer_name: customerName,
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

    let { data, error } = await client.from('orders').insert(row).select().maybeSingle();

    if (error && isLikelyMissingTrackingColumnsError(error)) {
      delete row.tracking_token;
      ({ data, error } = await client.from('orders').insert(row).select().maybeSingle());
    }

    if (error && (String(error.message || '').includes('checkout_adjustments') || String(error.message || '').includes('payment_method'))) {
      delete row.checkout_adjustments;
      delete row.payment_method;
      ({ data, error } = await client.from('orders').insert(row).select().maybeSingle());
    }

    if (!error && data?.id && orderSource === 'store') {
      const inv = await applyOrderInventory(String(data.id));
      if (inv.error) {
        const msg = String((inv.error as { message?: string })?.message ?? inv.error ?? '');
        await client.from('orders').delete().eq('id', data.id);
        return {
          data: null,
          error: {
            message: msg.includes('insufficient_stock') ? 'insufficient_stock' : 'inventory_failed',
            code: msg.includes('insufficient_stock') ? 'insufficient_stock' : 'inventory_failed',
          },
        };
      }
      const invPayload = inv.data as { applied?: boolean; reason?: string } | null;
      if (invPayload?.applied === false && invPayload.reason !== 'no_inventory_link') {
        await client.from('orders').delete().eq('id', data.id);
        return {
          data: null,
          error: { message: 'inventory_failed', code: 'inventory_failed' },
        };
      }
    }

    return { data: (data as Order | null) ?? null, error };
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
  orderSource: 'link' | 'manual' | 'store' = 'manual'
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
      total_amount: totalAmount,
      currency_code: currencyCode,
      status: 'pending',
      order_source: orderSource,
      tracking_token: trackingToken,
    };

    let { data, error } = await client.from('orders').insert(insertRow).select().maybeSingle();

    if (error && isLikelyMissingTrackingColumnsError(error)) {
      delete insertRow.tracking_token;
      ({ data, error } = await client.from('orders').insert(insertRow).select().maybeSingle());
    }

    return { data: (data as Order | null) ?? null, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export type FetchSellerOrdersOptions = {
  status?: 'pending' | 'completed' | 'cancelled';
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

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'completed' | 'cancelled'
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
  }
): Promise<{ data: Order | null; error: any }> {
  try {
    await ensureOrdersRlsHeaderFromSession();
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', orderId);

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
