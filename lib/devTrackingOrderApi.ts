import { createClient } from '@supabase/supabase-js';
import { getPublicTrackedOrderPayloadByToken } from './trackingOrderLookup.js';

export type DevTrackingOrderEnv = {
  supabaseUrl: string;
  supabaseServiceKey: string;
};

export async function handleDevTrackingOrderRequest(
  method: string,
  searchParams: URLSearchParams,
  env: DevTrackingOrderEnv
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  const token = String(searchParams.get('token') ?? '').trim();
  if (!token || token.length < 16) {
    return { status: 400, body: { error: 'Invalid tracking link' } };
  }

  if (!env.supabaseServiceKey) {
    return { status: 503, body: { error: 'Order tracking is not configured' } };
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
  const order = await getPublicTrackedOrderPayloadByToken(supabase, token);
  if (!order) {
    return { status: 404, body: { error: 'Order not found' } };
  }

  return { status: 200, body: order };
}
