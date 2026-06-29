import type { SupabaseClient } from '@supabase/supabase-js';

export type TrackingPaymentSummaryPayload = {
  status: string;
  method: string | null;
  provider: string | null;
  paid_at: string | null;
  customer_claimed_paid_at: string | null;
  payment_confirmed_by: string | null;
};

export type TrackingUpiCheckoutPayload = {
  vpa: string;
  amount: number;
  order_ref: string;
  store_name: string;
};

export type TrackingPaymentContextPayload = {
  payment_summary: TrackingPaymentSummaryPayload | null;
  upi_checkout: TrackingUpiCheckoutPayload | null;
};

type OrderRow = {
  id: string;
  seller_user_id: string;
  store_slug: string | null;
  payment_method: string | null;
  currency_code: string | null;
  total_amount: number | null;
  checkout_adjustments: Record<string, unknown> | null;
};

type PaymentRow = {
  status: string;
  payment_method: string | null;
  provider: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
};

function orderAmount(order: OrderRow): number {
  const fromAdjustments = order.checkout_adjustments?.grandTotal;
  if (typeof fromAdjustments === 'number' && Number.isFinite(fromAdjustments) && fromAdjustments > 0) {
    return fromAdjustments;
  }
  if (order.total_amount != null && Number.isFinite(order.total_amount)) {
    return Number(order.total_amount);
  }
  return 0;
}

function isUuidCastError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('operator does not exist') && (m.includes('uuid') || m.includes('text ='));
}

async function loadSellerUpiVpa(
  supabase: SupabaseClient,
  sellerUserId: string
): Promise<string> {
  const { data, error } = await supabase.rpc('get_seller_checkout_features', {
    p_seller_user_id: sellerUserId,
  });
  if (error) return '';
  const settings =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>).checkoutSettings
      : null;
  if (!settings || typeof settings !== 'object') return '';
  const vpa = (settings as Record<string, unknown>).sellerUpiId;
  return typeof vpa === 'string' ? vpa.trim().toLowerCase() : '';
}

export async function getTrackingPaymentContextByToken(
  supabase: SupabaseClient,
  trackingToken: string
): Promise<TrackingPaymentContextPayload | null> {
  const token = trackingToken.trim();
  if (!token || token.length < 16) return null;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, seller_user_id, store_slug, payment_method, currency_code, total_amount, checkout_adjustments'
    )
    .eq('tracking_token', token)
    .maybeSingle();

  if (orderError || !order) return null;

  const orderRow = order as OrderRow;

  let payment: PaymentRow | null = null;
  const { data: paymentRow, error: paymentError } = await supabase
    .from('order_payments')
    .select('status, payment_method, provider, paid_at, metadata')
    .eq('order_id', orderRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!paymentError && paymentRow) {
    payment = paymentRow as PaymentRow;
  } else if (paymentError && isUuidCastError(paymentError.message || '')) {
    const { data: paymentRows } = await supabase
      .from('order_payments')
      .select('status, payment_method, provider, paid_at, metadata, order_id')
      .eq('seller_user_id', orderRow.seller_user_id)
      .order('created_at', { ascending: false })
      .limit(20);
    const match = (paymentRows ?? []).find(
      (row) => String((row as { order_id?: string }).order_id ?? '') === String(orderRow.id)
    );
    if (match) payment = match as PaymentRow;
  }

  let paymentStatus = 'pending';
  let paymentSummary: TrackingPaymentSummaryPayload | null = null;

  if (payment) {
    paymentStatus = payment.status;
    const meta = payment.metadata ?? {};
    paymentSummary = {
      status: payment.status,
      method: payment.payment_method ?? orderRow.payment_method,
      provider: payment.provider,
      paid_at: payment.paid_at,
      customer_claimed_paid_at:
        typeof meta.customer_claimed_paid_at === 'string' ? meta.customer_claimed_paid_at : null,
      payment_confirmed_by:
        meta.payment_confirmed_by === 'customer' || meta.payment_confirmed_by === 'seller'
          ? meta.payment_confirmed_by
          : null,
    };
  } else if (orderRow.payment_method) {
    paymentSummary = {
      status: 'pending',
      method: orderRow.payment_method,
      provider: null,
      paid_at: null,
      customer_claimed_paid_at: null,
      payment_confirmed_by: null,
    };
  }

  let upiCheckout: TrackingUpiCheckoutPayload | null = null;

  if (orderRow.payment_method === 'upi' && paymentStatus !== 'paid') {
    const vpa = await loadSellerUpiVpa(supabase, orderRow.seller_user_id);
    const amount = orderAmount(orderRow);

    if (vpa && amount > 0) {
      upiCheckout = {
        vpa,
        amount,
        order_ref: String(orderRow.id).slice(0, 8).toUpperCase(),
        store_name: String(orderRow.store_slug ?? 'Store'),
      };
    }
  }

  return {
    payment_summary: paymentSummary,
    upi_checkout: upiCheckout,
  };
}
