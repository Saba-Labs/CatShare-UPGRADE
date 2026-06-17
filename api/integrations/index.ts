import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../../lib/supabaseAuthRequest.js';
import { listIntegrations } from '../../lib/integrationsServer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'GET, OPTIONS')) return;
  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (auth.ok === false) return res.status(401).json({ error: auth.error });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const integrations = await listIntegrations(supabase, auth.userId);
    return res.status(200).json({ integrations });
  } catch (e) {
    console.error('integrations index:', e);
    return res.status(500).json({ error: 'Could not load integrations' });
  }
}
