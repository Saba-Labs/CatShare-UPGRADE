import type { SupabaseClient } from '@supabase/supabase-js';
import { getTrackingPaymentContextByToken } from './trackingOrderPayment.js';

export async function getPublicTrackedOrderPayloadByToken(
  supabase: SupabaseClient,
  trackingToken: string
): Promise<Record<string, unknown> | null> {
  const token = trackingToken.trim();
  if (!token || token.length < 16) return null;

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('tracking_token', token)
    .maybeSingle();

  if (paymentError || !order) return null;

  const paymentCtx = await getTrackingPaymentContextByToken(supabase, token).catch(() => null);
  const payload: Record<string, unknown> = { ...(order as Record<string, unknown>) };

  if (paymentCtx?.payment_summary) {
    payload.payment_summary = paymentCtx.payment_summary;
  }
  if (paymentCtx?.upi_checkout) {
    payload.upi_checkout = paymentCtx.upi_checkout;
  }

  return payload;
}
