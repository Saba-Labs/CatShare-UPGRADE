import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../lib/apiCors.js';
import { getTrackingPaymentContextByToken } from '../lib/trackingOrderPayment.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'GET, OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = String(req.query.token ?? '').trim();
  if (!token || token.length < 16) {
    return res.status(400).json({ error: 'Invalid tracking token' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Tracking payment sync is not configured' });
  }

  try {
    const context = await getTrackingPaymentContextByToken(supabase, token);
    if (!context) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.status(200).json(context);
  } catch (e) {
    console.error('tracking-payment:', e);
    const msg = e instanceof Error ? e.message : 'Failed to load payment status';
    return res.status(500).json({ error: msg });
  }
}
