import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../../lib/supabaseAuthRequest.js';
import {
  isValidProvider,
  stubRazorpayMetadata,
  upsertIntegration,
  type IntegrationProviderId,
} from '../../lib/integrationsServer.js';
import { connectShiprocketIntegration } from '../../lib/shiprocketIntegration.js';
import { ShiprocketApiError } from '../../lib/shiprocketServer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'POST, OPTIONS')) return;
  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (auth.ok === false) return res.status(401).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body ?? {}) as {
    provider?: string;
    shiprocket?: { email?: string; password?: string };
  };
  const provider = String(body.provider ?? '').trim();
  if (!isValidProvider(provider)) return res.status(400).json({ error: 'Invalid provider' });

  try {
    const now = new Date().toISOString();
    if (provider === 'shiprocket') {
      const email = String(body.shiprocket?.email ?? '').trim();
      const password = String(body.shiprocket?.password ?? '');
      const integration = await connectShiprocketIntegration(supabase, auth.userId, email, password);
      return res.status(200).json({ integration, oauthUrl: null });
    }

    const metadata = stubRazorpayMetadata();
    const integration = await upsertIntegration(
      supabase,
      auth.userId,
      provider as IntegrationProviderId,
      {
        status: 'pending_verification',
        account_id: String(metadata.merchantId ?? ''),
        metadata,
        connected_at: now,
      }
    );
    return res.status(200).json({ integration, oauthUrl: null });
  } catch (e) {
    console.error('integrations connect:', e);
    const msg =
      e instanceof ShiprocketApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Could not connect integration';
    const status = e instanceof ShiprocketApiError && e.status === 401 ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}
