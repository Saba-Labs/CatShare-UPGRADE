import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../../../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../../../lib/supabaseAuthRequest.js';
import { createShiprocketShipmentForOrder } from '../../../lib/shiprocketIntegration.js';
import { ShiprocketApiError } from '../../../lib/shiprocketServer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'POST, OPTIONS')) return;

  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (auth.ok === false) {
    return res.status(401).json({ error: auth.error });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const orderId = String((req.body as { orderId?: string })?.orderId ?? '').trim();
  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }

  try {
    const shipment = await createShiprocketShipmentForOrder(
      supabase,
      auth.userId,
      orderId
    );
    return res.status(200).json({ shipment });
  } catch (e) {
    console.error('integrations shipments create:', e);
    const msg =
      e instanceof ShiprocketApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Could not create shipment';
    const status =
      msg.includes('not found') ||
      msg.includes('delivery address') ||
      msg.includes('Connect Shiprocket')
        ? 400
        : 500;
    return res.status(status).json({ error: msg });
  }
}

