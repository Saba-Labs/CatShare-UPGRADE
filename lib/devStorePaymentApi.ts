import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  beginRazorpayCheckoutForOrder,
  confirmRazorpayCheckoutForOrder,
} from './razorpayIntegration.js';

export type DevStorePaymentEnv = {
  supabaseUrl: string;
  supabaseServiceKey: string;
};

function createServiceSupabase(env: DevStorePaymentEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceKey);
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>
): { status: number; body: Record<string, unknown> } {
  return { status, body };
}

export async function handleDevStorePaymentRequest(
  method: string,
  path: string,
  body: Record<string, unknown>,
  env: DevStorePaymentEnv
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabase = createServiceSupabase(env);

  if (path === '/api/store-payments/razorpay/begin') {
    const orderId = String(body.orderId ?? '').trim();
    if (!orderId) return jsonResponse(400, { error: 'orderId is required' });
    try {
      const checkout = await beginRazorpayCheckoutForOrder(supabase, orderId);
      return jsonResponse(200, { checkout });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment request failed';
      return jsonResponse(400, { error: msg });
    }
  }

  if (path === '/api/store-payments/razorpay/confirm') {
    const orderId = String(body.orderId ?? '').trim();
    const razorpayOrderId = String(body.razorpayOrderId ?? '').trim();
    const razorpayPaymentId = String(body.razorpayPaymentId ?? '').trim();
    const razorpaySignature = String(body.razorpaySignature ?? '').trim();
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return jsonResponse(400, { error: 'Missing payment confirmation fields' });
    }
    try {
      const payment = await confirmRazorpayCheckoutForOrder(
        supabase,
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );
      return jsonResponse(200, { payment });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment verification failed';
      return jsonResponse(400, { error: msg });
    }
  }

  return jsonResponse(404, { error: 'Not found' });
}
