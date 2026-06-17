/**
 * Shiprocket webhook stub — future: verify token and update order_shipments timeline.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyApiCors } from '../../../lib/apiCors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: verify Shiprocket webhook authenticity
  // TODO: map tracking events → order_shipments.timeline

  console.info('[webhook stub] shiprocket', {
    receivedAt: new Date().toISOString(),
  });

  return res.status(200).json({ received: true, stub: true });
}
