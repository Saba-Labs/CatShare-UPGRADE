import { supabase } from '../supabaseClient';
import { getPublicWebBaseUrl } from '../utils/publicWebBaseUrl';
import type { Order, OrderItem } from './orderService';

export function generateOrderTrackingToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildOrderTrackingUrl(trackingToken: string): string {
  const token = trackingToken.trim();
  return `${getPublicWebBaseUrl()}/track/${encodeURIComponent(token)}`;
}

function isLikelyMissingTrackingColumnsError(err: { message?: string; code?: string }): boolean {
  const m = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === 'PGRST204') return true;
  if (
    (m.includes('tracking_token') || m.includes('store_slug') || m.includes('customer_edited_at')) &&
    (m.includes('column') || m.includes('schema cache') || m.includes('could not find'))
  ) {
    return true;
  }
  return false;
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
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    tracking_token: row.tracking_token != null ? String(row.tracking_token) : undefined,
    store_slug: row.store_slug != null ? String(row.store_slug) : undefined,
    customer_edited_at: row.customer_edited_at != null ? String(row.customer_edited_at) : undefined,
  };
}

export async function fetchOrderByTrackingToken(
  trackingToken: string
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const token = trackingToken.trim();
    if (!token) return { data: null, error: 'Invalid tracking link' };

    const { data, error } = await supabase.rpc('get_order_by_tracking_token', {
      p_token: token,
    });

    if (error) {
      const msg = error.message || '';
      if (/function.*does not exist/i.test(msg) || /could not find/i.test(msg)) {
        return {
          data: null,
          error: 'Order tracking is not enabled yet. Ask the seller to update CatShare.',
        };
      }
      return { data: null, error: error.message };
    }

    if (!data || typeof data !== 'object') {
      return { data: null, error: 'Order not found. The link may be invalid or expired.' };
    }

    return { data: normalizeOrderRow(data as Record<string, unknown>), error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load order',
    };
  }
}

export type UpdateOrderByTrackingTokenInput = {
  trackingToken: string;
  customerName: string;
  customerWhatsapp?: string;
  items: OrderItem[];
  totalAmount?: number;
  status?: 'pending' | 'cancelled';
};

export async function updateOrderByTrackingToken(
  input: UpdateOrderByTrackingTokenInput
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const token = input.trackingToken.trim();
    if (!token) return { data: null, error: 'Invalid tracking link' };

    const { data, error } = await supabase.rpc('update_order_by_tracking_token', {
      p_token: token,
      p_customer_name: input.customerName.trim(),
      p_customer_whatsapp: input.customerWhatsapp?.trim() || null,
      p_items: input.items,
      p_total_amount: input.totalAmount ?? null,
      p_status: input.status ?? null,
    });

    if (error) {
      const code = error.message || '';
      if (code.includes('order_locked')) {
        return { data: null, error: 'This order has been confirmed and can no longer be edited.' };
      }
      if (code.includes('order_cancelled')) {
        return { data: null, error: 'This order was cancelled and can no longer be edited.' };
      }
      if (code.includes('customer_name_required')) {
        return { data: null, error: 'Please enter your name.' };
      }
      if (code.includes('items_required')) {
        return { data: null, error: 'Add at least one item to the order.' };
      }
      if (/function.*does not exist/i.test(code)) {
        return {
          data: null,
          error: 'Order tracking is not enabled yet. Ask the seller to update CatShare.',
        };
      }
      return { data: null, error: error.message };
    }

    if (!data || typeof data !== 'object') {
      return { data: null, error: 'Failed to save order' };
    }

    return { data: normalizeOrderRow(data as Record<string, unknown>), error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to save order',
    };
  }
}

export { isLikelyMissingTrackingColumnsError };
