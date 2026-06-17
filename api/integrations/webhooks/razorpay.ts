/**
 * Razorpay webhook stub — future: verify signature and update order_payments.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyApiCors } from '../../../lib/apiCors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: verify Razorpay webhook signature (x-razorpay-signature)
  // TODO: map event type → upsert order_payments via service role

  console.info('[webhook stub] razorpay', {
    event: (req.body as { event?: string })?.event,
    receivedAt: new Date().toISOString(),
  });

  return res.status(200).json({ received: true, stub: true });
}
