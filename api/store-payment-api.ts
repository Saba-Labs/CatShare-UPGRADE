import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../lib/apiCors.js';
import {
  beginRazorpayCheckoutForOrder,
  confirmRazorpayCheckoutForOrder,
} from '../lib/razorpayIntegration.js';
import { RazorpayApiError } from '../lib/razorpayServer.js';

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
  if (applyApiCors(req, res, 'POST, OPTIONS')) return;

  const key = routeKey(req);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (key === 'razorpay/begin') {
      const orderId = String((req.body as { orderId?: string })?.orderId ?? '').trim();
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }
      const checkout = await beginRazorpayCheckoutForOrder(supabase, orderId);
      return res.status(200).json({ checkout });
    }

    if (key === 'razorpay/confirm') {
      const body = (req.body ?? {}) as {
        orderId?: string;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
      };
      const orderId = String(body.orderId ?? '').trim();
      const razorpayOrderId = String(body.razorpayOrderId ?? '').trim();
      const razorpayPaymentId = String(body.razorpayPaymentId ?? '').trim();
      const razorpaySignature = String(body.razorpaySignature ?? '').trim();
      if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ error: 'Missing payment confirmation fields' });
      }
      const payment = await confirmRazorpayCheckoutForOrder(
        supabase,
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );
      return res.status(200).json({ payment });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error('store-payment-api:', e);
    const msg =
      e instanceof RazorpayApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Payment request failed';
    const status =
      msg.includes('not found') ||
      msg.includes('not connected') ||
      msg.includes('not a prepaid')
        ? 400
        : 500;
    return res.status(status).json({ error: msg });
  }
}
