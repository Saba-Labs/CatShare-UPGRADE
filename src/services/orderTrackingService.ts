import { supabase } from '../supabaseClient';
import { getPublicWebBaseUrl } from '../utils/publicWebBaseUrl';
import type { Order, OrderItem } from './orderService';

export type TrackOrderPaymentSummary = {
  status: string;
  method: string | null;
  provider: string | null;
  paidAt: string | null;
  customerClaimedPaidAt: string | null;
  paymentConfirmedBy: 'customer' | 'seller' | null;
};

export type TrackOrderUpiCheckout = {
  vpa: string;
  amount: number;
  orderRef: string;
  storeName?: string;
};

export type TrackedOrder = Order & {
  paymentSummary?: TrackOrderPaymentSummary | null;
  upiCheckout?: TrackOrderUpiCheckout | null;
};

export type CustomerPaymentStatusView = {
  label: string;
  hint: string;
  pillClass: string;
};

export function getCustomerPaymentStatusView(
  summary: TrackOrderPaymentSummary | null | undefined,
  orderPaymentMethod?: string | null
): CustomerPaymentStatusView | null {
  const method = summary?.method ?? orderPaymentMethod ?? null;
  if (!method) return null;

  const status = summary?.status ?? 'pending';

  if (status === 'paid') {
    if (method === 'upi') {
      return {
        label: 'Paid',
        hint:
          summary?.paymentConfirmedBy === 'seller'
            ? 'The seller confirmed your UPI payment.'
            : 'Your UPI payment is recorded. The seller may still verify it in their app.',
        pillClass: 'trk-pill--paid',
      };
    }
    if (method === 'cod') {
      return {
        label: 'Paid on delivery',
        hint: 'Payment was collected when your order was delivered.',
        pillClass: 'trk-pill--paid',
      };
    }
    return {
      label: 'Paid online',
      hint: 'Your online payment was received.',
      pillClass: 'trk-pill--paid',
    };
  }

  if (method === 'cod') {
    return {
      label: 'Pay on delivery',
      hint: 'You will pay the seller when your order is delivered.',
      pillClass: 'trk-pill--cod',
    };
  }

  if (method === 'upi') {
    return {
      label: 'Payment pending',
      hint: 'Tap Pay via UPI to open the QR code and complete payment.',
      pillClass: 'trk-pill--payment-pending',
    };
  }

  if (method === 'manual') {
    return {
      label: 'Payment with seller',
      hint: 'The seller will coordinate payment with you directly.',
      pillClass: 'trk-pill--cod',
    };
  }

  if (status === 'failed') {
    return {
      label: 'Payment failed',
      hint: 'Online payment did not go through. Contact the seller if you need help.',
      pillClass: 'trk-pill--cancelled',
    };
  }

  return {
    label: 'Payment processing',
    hint: 'Your online payment is being processed.',
    pillClass: 'trk-pill--payment-pending',
  };
}

function parsePaymentSummary(row: Record<string, unknown>): TrackOrderPaymentSummary | null {
  const raw = row.payment_summary;
  if (!raw || typeof raw !== 'object') return null;
  const ps = raw as Record<string, unknown>;
  const confirmedBy = ps.payment_confirmed_by;
  return {
    status: String(ps.status ?? 'pending'),
    method: ps.method != null ? String(ps.method) : null,
    provider: ps.provider != null ? String(ps.provider) : null,
    paidAt: ps.paid_at != null ? String(ps.paid_at) : null,
    customerClaimedPaidAt:
      ps.customer_claimed_paid_at != null ? String(ps.customer_claimed_paid_at) : null,
    paymentConfirmedBy:
      confirmedBy === 'customer' || confirmedBy === 'seller' ? confirmedBy : null,
  };
}

function parseUpiCheckout(row: Record<string, unknown>): TrackOrderUpiCheckout | null {
  const raw = row.upi_checkout;
  if (!raw || typeof raw !== 'object') return null;
  const uc = raw as Record<string, unknown>;
  const vpa = uc.vpa != null ? String(uc.vpa).trim() : '';
  const amount = uc.amount != null ? Number(uc.amount) : NaN;
  if (!vpa || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    vpa,
    amount,
    orderRef: uc.order_ref != null ? String(uc.order_ref) : '',
    storeName: uc.store_name != null ? String(uc.store_name) : undefined,
  };
}

export function isTrackOrderUpiPending(order: TrackedOrder): boolean {
  const method = order.paymentSummary?.method ?? order.payment_method ?? null;
  if (method !== 'upi') return false;
  return (order.paymentSummary?.status ?? 'pending') !== 'paid';
}

function applyPaymentContext(
  order: TrackedOrder,
  ctx: { payment_summary?: unknown; upi_checkout?: unknown }
): TrackedOrder {
  let next = { ...order };
  const summary = parsePaymentSummary({ payment_summary: ctx.payment_summary });
  const upiCheckout = parseUpiCheckout({ upi_checkout: ctx.upi_checkout });
  if (summary) next = { ...next, paymentSummary: summary };
  if (upiCheckout) {
    next = { ...next, upiCheckout };
  } else if (summary?.status === 'paid') {
    next = { ...next, upiCheckout: undefined };
  }
  return next;
}

async function fetchTrackingPaymentContextFromApi(
  trackingToken: string
): Promise<{ payment_summary?: unknown; upi_checkout?: unknown } | null> {
  try {
    const res = await fetch(
      `/api/tracking-payment?token=${encodeURIComponent(trackingToken)}`
    );
    if (!res.ok) return null;
    return (await res.json()) as { payment_summary?: unknown; upi_checkout?: unknown };
  } catch {
    return null;
  }
}

async function enrichTrackedOrder(order: TrackedOrder, trackingToken: string): Promise<TrackedOrder> {
  let next = { ...order };

  const apiCtx = await fetchTrackingPaymentContextFromApi(trackingToken);
  if (apiCtx) {
    return applyPaymentContext(next, apiCtx);
  }

  try {
    const { data, error } = await supabase.rpc('get_order_tracking_payment_context', {
      p_token: trackingToken,
    });
    if (!error && data && typeof data === 'object') {
      const ctx = data as Record<string, unknown>;
      next = applyPaymentContext(next, {
        payment_summary: ctx.payment_summary,
        upi_checkout: ctx.upi_checkout,
      });
    }
  } catch {
    /* optional RPC */
  }

  if (!next.upiCheckout && isTrackOrderUpiPending(next) && next.seller_user_id) {
    try {
      const { data } = await supabase.rpc('get_seller_checkout_features', {
        p_seller_user_id: next.seller_user_id,
      });
      const settings =
        data && typeof data === 'object'
          ? (data as Record<string, unknown>).checkoutSettings
          : null;
      const vpa =
        settings && typeof settings === 'object'
          ? String((settings as Record<string, unknown>).sellerUpiId ?? '').trim()
          : '';
      const amount =
        next.checkout_adjustments?.grandTotal ?? next.total_amount ?? 0;
      if (vpa && amount > 0) {
        next = {
          ...next,
          upiCheckout: {
            vpa: vpa.toLowerCase(),
            amount,
            orderRef: next.id.slice(0, 8).toUpperCase(),
            storeName: next.store_slug,
          },
        };
      }
    } catch {
      /* ignore */
    }
  }

  return next;
}

export function generateOrderTrackingToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildOrderTrackingUrl(trackingToken: string, baseUrl?: string): string {
  const token = trackingToken.trim();
  const base = (baseUrl ?? getPublicWebBaseUrl()).replace(/\/$/, '');
  return `${base}/track/${encodeURIComponent(token)}`;
}

/** Prefer the seller's current app origin when copying links (avoids localhost → production mismatch). */
export function buildOrderTrackingUrlForSeller(trackingToken: string): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if (!isLocal) {
      return buildOrderTrackingUrl(trackingToken, origin);
    }
  }
  return buildOrderTrackingUrl(trackingToken);
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

function normalizeOrderRow(row: Record<string, unknown>): TrackedOrder {
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
    payment_method: row.payment_method as Order['payment_method'],
    checkout_adjustments:
      row.checkout_adjustments && typeof row.checkout_adjustments === 'object'
        ? (row.checkout_adjustments as Order['checkout_adjustments'])
        : undefined,
    paymentSummary: parsePaymentSummary(row),
    upiCheckout: parseUpiCheckout(row),
  };
}

async function fetchOrderByTrackingTokenFromApi(
  trackingToken: string
): Promise<TrackedOrder | null> {
  try {
    const res = await fetch(
      `/api/tracking-order?token=${encodeURIComponent(trackingToken)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    return normalizeOrderRow(data);
  } catch {
    return null;
  }
}

export async function fetchOrderByTrackingToken(
  trackingToken: string
): Promise<{ data: TrackedOrder | null; error: string | null }> {
  try {
    const token = trackingToken.trim();
    if (!token) return { data: null, error: 'Invalid tracking link' };
    if (token.length < 16) {
      return {
        data: null,
        error: 'Invalid tracking link. Ask the seller to copy the link again from the order page.',
      };
    }

    const fromApi = await fetchOrderByTrackingTokenFromApi(token);
    if (fromApi?.id) {
      const enriched = await enrichTrackedOrder(fromApi, token);
      return { data: enriched, error: null };
    }

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

    const base = normalizeOrderRow(data as Record<string, unknown>);
    const enriched = await enrichTrackedOrder(base, token);
    return { data: enriched, error: null };
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
  customerNotes?: string;
  items: OrderItem[];
  totalAmount?: number;
  status?: 'pending' | 'cancelled';
};

export async function updateOrderByTrackingToken(
  input: UpdateOrderByTrackingTokenInput
): Promise<{ data: TrackedOrder | null; error: string | null }> {
  try {
    const token = input.trackingToken.trim();
    if (!token) return { data: null, error: 'Invalid tracking link' };

    const { data, error } = await supabase.rpc('update_order_by_tracking_token', {
      p_token: token,
      p_customer_name: input.customerName.trim(),
      p_customer_whatsapp: input.customerWhatsapp?.trim() || null,
      p_customer_notes: input.customerNotes?.trim() || null,
      p_items: input.items,
      p_total_amount: input.totalAmount ?? null,
      p_status: input.status ?? null,
    });

    if (error) {
      const code = error.message || '';
      if (code.includes('order_locked')) {
        return { data: null, error: 'This order is being processed and can no longer be edited.' };
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

    const base = normalizeOrderRow(data as Record<string, unknown>);
    const enriched = await enrichTrackedOrder(base, token);
    return { data: enriched, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to save order',
    };
  }
}

export async function claimUpiPaymentByTrackingToken(
  trackingToken: string
): Promise<{ ok: boolean; error: string | null; order: TrackedOrder | null }> {
  try {
    const token = trackingToken.trim();
    if (!token) return { ok: false, error: 'Invalid tracking link', order: null };

    const { error } = await supabase.rpc('claim_upi_payment_by_tracking_token', {
      p_token: token,
    });

    if (error) {
      const msg = error.message || '';
      if (/function.*does not exist/i.test(msg)) {
        return {
          ok: false,
          error: 'Payment tracking is not enabled yet. Ask the seller to update CatShare.',
          order: null,
        };
      }
      if (msg.includes('not_upi_order')) {
        return { ok: false, error: 'This order does not use UPI payment.', order: null };
      }
      if (msg.includes('order_not_found')) {
        return { ok: false, error: 'Order not found.', order: null };
      }
      return { ok: false, error: msg, order: null };
    }

    const refreshed = await fetchOrderByTrackingToken(token);
    return { ok: true, error: null, order: refreshed.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not record payment',
      order: null,
    };
  }
}

export { isLikelyMissingTrackingColumnsError };
