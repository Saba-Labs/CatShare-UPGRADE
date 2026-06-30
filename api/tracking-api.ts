import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../lib/apiCors.js';
import { getPublicTrackedOrderPayloadByToken } from '../lib/trackingOrderLookup.js';
import { getTrackingPaymentContextByToken } from '../lib/trackingOrderPayment.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function routeKey(req: VercelRequest): string {
  const fromQuery = req.query.route;
  if (Array.isArray(fromQuery)) return fromQuery.join('/');
  if (typeof fromQuery === 'string') return fromQuery;
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'GET, OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = String(req.query.token ?? '').trim();
  if (!token || token.length < 16) {
    const key = routeKey(req);
    return res.status(400).json({
      error: key === 'payment' ? 'Invalid tracking token' : 'Invalid tracking link',
    });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const key = routeKey(req);
    return res.status(503).json({
      error:
        key === 'payment'
          ? 'Tracking payment sync is not configured'
          : 'Order tracking is not configured',
    });
  }

  const key = routeKey(req);

  try {
    if (key === 'order') {
      const order = await getPublicTrackedOrderPayloadByToken(supabase, token);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.status(200).json(order);
    }

    if (key === 'payment') {
      const context = await getTrackingPaymentContextByToken(supabase, token);
      if (!context) {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.status(200).json(context);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error('tracking-api:', e);
    const msg = e instanceof Error ? e.message : 'Request failed';
    return res.status(500).json({ error: msg });
  }
}
