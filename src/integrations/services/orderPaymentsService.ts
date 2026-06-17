/**
 * Order payment records (gateway transactions).
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import type { OrderPayment, OrderPaymentStatus } from '../core/types';

function mapPaymentRow(row: Record<string, unknown>): OrderPayment {
  return {
    id: String(row.id ?? ''),
    orderId: String(row.order_id ?? row.orderId ?? ''),
    sellerUserId: String(row.seller_user_id ?? row.sellerUserId ?? ''),
    provider: String(row.provider ?? ''),
    status: String(row.status ?? 'pending') as OrderPaymentStatus,
    paymentId: row.payment_id != null ? String(row.payment_id) : null,
    providerOrderId:
      row.provider_order_id != null ? String(row.provider_order_id) : null,
    amount: row.amount != null ? Number(row.amount) : null,
    currency: String(row.currency ?? 'INR'),
    paymentMethod:
      row.payment_method != null ? String(row.payment_method) : null,
    customerName:
      row.customer_name != null ? String(row.customer_name) : null,
    customerEmail:
      row.customer_email != null ? String(row.customer_email) : null,
    customerPhone:
      row.customer_phone != null ? String(row.customer_phone) : null,
    paidAt: row.paid_at != null ? String(row.paid_at) : null,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at ?? row.createdAt ?? ''),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ''),
  };
}

export async function fetchOrderPaymentByOrderId(
  sellerUserId: string,
  orderId: string
): Promise<{ data: OrderPayment | null; error: unknown }> {
  try {
    if (!sellerUserId || !orderId) {
      return { data: null, error: new Error('Missing seller or order id') };
    }
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('order_payments')
      .select('*')
      .eq('seller_user_id', sellerUserId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { data: null, error: null };
      }
      return { data: null, error };
    }
    if (!data) return { data: null, error: null };
    return { data: mapPaymentRow(data as Record<string, unknown>), error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

/** Future: webhook handlers will call this to upsert payment status */
export async function upsertOrderPayment(
  sellerUserId: string,
  payment: Partial<OrderPayment> & { orderId: string; provider: string }
): Promise<{ data: OrderPayment | null; error: unknown }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const row = {
      order_id: payment.orderId,
      seller_user_id: sellerUserId,
      provider: payment.provider,
      status: payment.status ?? 'pending',
      payment_id: payment.paymentId ?? null,
      provider_order_id: payment.providerOrderId ?? null,
      amount: payment.amount ?? null,
      currency: payment.currency ?? 'INR',
      payment_method: payment.paymentMethod ?? null,
      customer_name: payment.customerName ?? null,
      customer_email: payment.customerEmail ?? null,
      customer_phone: payment.customerPhone ?? null,
      paid_at: payment.paidAt ?? null,
      metadata: payment.metadata ?? {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await getSupabaseClient()
      .from('order_payments')
      .upsert(row, { onConflict: 'order_id' })
      .select()
      .single();

    if (error) return { data: null, error };
    return {
      data: mapPaymentRow(data as Record<string, unknown>),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
