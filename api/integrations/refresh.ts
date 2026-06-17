import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../../lib/supabaseAuthRequest.js';
import {
  getIntegration,
  isValidProvider,
  stubRazorpayMetadata,
  upsertIntegration,
  type IntegrationProviderId,
} from '../../lib/integrationsServer.js';
import { refreshShiprocketIntegration } from '../../lib/shiprocketIntegration.js';
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

  const provider = String((req.body as { provider?: string })?.provider ?? '').trim();
  if (!isValidProvider(provider)) return res.status(400).json({ error: 'Invalid provider' });

  try {
    if (provider === 'shiprocket') {
      const integration = await refreshShiprocketIntegration(supabase, auth.userId);
      return res.status(200).json({ integration });
    }

    const existing = await getIntegration(supabase, auth.userId, provider as IntegrationProviderId);
    if (!existing) return res.status(404).json({ error: 'Integration not connected' });

    const now = new Date().toISOString();
    let status = String(existing.status ?? 'not_connected');
    let metadata =
      existing.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    if (provider === 'razorpay' && status === 'pending_verification') {
      status = 'connected';
      metadata = { ...stubRazorpayMetadata(), ...metadata, accountStatus: 'activated' };
    }

    const integration = await upsertIntegration(
      supabase,
      auth.userId,
      provider as IntegrationProviderId,
      {
        status,
        account_id: existing.account_id != null ? String(existing.account_id) : null,
        metadata,
        connected_at: existing.connected_at != null ? String(existing.connected_at) : now,
      }
    );

    return res.status(200).json({ integration });
  } catch (e) {
    console.error('integrations refresh:', e);
    const msg =
      e instanceof ShiprocketApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Could not refresh integration status';
    return res.status(500).json({ error: msg });
  }
}
