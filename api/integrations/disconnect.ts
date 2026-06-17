import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../../lib/supabaseAuthRequest.js';
import {
  deleteIntegration,
  isValidProvider,
  type IntegrationProviderId,
} from '../../lib/integrationsServer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'POST, OPTIONS')) return;

  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provider = String((req.body as { provider?: string })?.provider ?? '').trim();
  if (!isValidProvider(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  try {
    await deleteIntegration(supabase, auth.userId, provider as IntegrationProviderId);
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('integrations disconnect:', e);
    return res.status(500).json({ error: 'Could not disconnect integration' });
  }
}
