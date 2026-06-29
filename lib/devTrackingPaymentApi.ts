import { createClient } from '@supabase/supabase-js';
import { getTrackingPaymentContextByToken } from './trackingOrderPayment.js';

export type DevTrackingPaymentEnv = {
  supabaseUrl: string;
  supabaseServiceKey: string;
};

export async function handleDevTrackingPaymentRequest(
  method: string,
  searchParams: URLSearchParams,
  env: DevTrackingPaymentEnv
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  const token = String(searchParams.get('token') ?? '').trim();
  if (!token || token.length < 16) {
    return { status: 400, body: { error: 'Invalid tracking token' } };
  }

  if (!env.supabaseServiceKey) {
    return { status: 503, body: { error: 'Tracking payment sync is not configured' } };
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
  const context = await getTrackingPaymentContextByToken(supabase, token);
  if (!context) {
    return { status: 404, body: { error: 'Order not found' } };
  }

  return { status: 200, body: context as unknown as Record<string, unknown> };
}
