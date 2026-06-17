import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../../lib/supabaseAuthRequest.js';
import {
  deleteIntegration,
  getIntegration,
  isValidProvider,
  listIntegrations,
  stubRazorpayMetadata,
  upsertIntegration,
  type IntegrationProviderId,
} from '../../lib/integrationsServer.js';
import {
  connectShiprocketIntegration,
  createShiprocketShipmentForOrder,
  refreshShiprocketIntegration,
} from '../../lib/shiprocketIntegration.js';
import { ShiprocketApiError } from '../../lib/shiprocketServer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function routeKey(req: VercelRequest): string {
  const param = req.query.route;
  if (Array.isArray(param)) return param.join('/');
  return param ? String(param) : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'GET, POST, OPTIONS')) return;

  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (auth.ok === false) {
    return res.status(401).json({ error: auth.error });
  }

  const key = routeKey(req);

  if (key === '' && req.method === 'GET') {
    try {
      const integrations = await listIntegrations(supabase, auth.userId);
      return res.status(200).json({ integrations });
    } catch (e) {
      console.error('integrations index:', e);
      return res.status(500).json({ error: 'Could not load integrations' });
    }
  }

  if (key === 'connect' && req.method === 'POST') {
    const body = (req.body ?? {}) as {
      provider?: string;
      shiprocket?: { email?: string; password?: string };
    };
    const provider = String(body.provider ?? '').trim();
    if (!isValidProvider(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    try {
      const now = new Date().toISOString();

      if (provider === 'shiprocket') {
        const email = String(body.shiprocket?.email ?? '').trim();
        const password = String(body.shiprocket?.password ?? '');
        const integration = await connectShiprocketIntegration(
          supabase,
          auth.userId,
          email,
          password
        );
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

      return res.status(200).json({
        integration,
        oauthUrl: null,
        message:
          'MVP stub: real OAuth will be enabled when gateway credentials are configured.',
      });
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

  if (key === 'disconnect' && req.method === 'POST') {
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

  if (key === 'refresh' && req.method === 'POST') {
    const provider = String((req.body as { provider?: string })?.provider ?? '').trim();
    if (!isValidProvider(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    try {
      if (provider === 'shiprocket') {
        const integration = await refreshShiprocketIntegration(supabase, auth.userId);
        return res.status(200).json({ integration });
      }

      const existing = await getIntegration(
        supabase,
        auth.userId,
        provider as IntegrationProviderId
      );

      if (!existing) {
        return res.status(404).json({ error: 'Integration not connected' });
      }

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

  if (key === 'shipments/create' && req.method === 'POST') {
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

  return res.status(404).json({ error: 'Not found' });
}
