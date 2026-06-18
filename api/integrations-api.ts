import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyApiCors } from '../lib/apiCors.js';
import { getSupabaseUserFromRequest } from '../lib/supabaseAuthRequest.js';
import {
  deleteIntegration,
  isValidProvider,
  listIntegrations,
  type IntegrationProviderId,
} from '../lib/integrationsServer.js';
import { syncStoreIntegrationFlags } from '../lib/storeIntegrationFlags.js';
import {
  connectRazorpayIntegration,
  refreshRazorpayIntegration,
} from '../lib/razorpayIntegration.js';
import {
  connectShiprocketIntegration,
  createShiprocketShipmentForOrder,
  refreshShiprocketIntegration,
} from '../lib/shiprocketIntegration.js';
import { RazorpayApiError } from '../lib/razorpayServer.js';
import { ShiprocketApiError } from '../lib/shiprocketServer.js';

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

async function handleRazorpayWebhook(req: VercelRequest, res: VercelResponse) {
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

async function handleShiprocketWebhook(req: VercelRequest, res: VercelResponse) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, 'GET, POST, OPTIONS')) return;

  const key = routeKey(req);

  if (key === 'webhooks/razorpay') {
    return handleRazorpayWebhook(req, res);
  }
  if (key === 'webhooks/shiprocket') {
    return handleShiprocketWebhook(req, res);
  }

  const auth = await getSupabaseUserFromRequest(req.headers.authorization);
  if (auth.ok === false) {
    return res.status(401).json({ error: auth.error });
  }

  if (key === '' && req.method === 'GET') {
    try {
      const integrations = await listIntegrations(supabase, auth.userId);
      await syncStoreIntegrationFlags(supabase, auth.userId).catch(() => undefined);
      return res.status(200).json({ integrations });
    } catch (e) {
      console.error('integrations index:', e);
      return res.status(500).json({ error: 'Could not load integrations' });
    }
  }

  if (key === 'connect' && req.method === 'POST') {
    const body = (req.body ?? {}) as {
      provider?: string;
      razorpay?: { keyId?: string; keySecret?: string };
      shiprocket?: { email?: string; password?: string };
    };
    const provider = String(body.provider ?? '').trim();
    if (!isValidProvider(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    try {
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

      if (provider === 'razorpay') {
        const keyId = String(body.razorpay?.keyId ?? '').trim();
        const keySecret = String(body.razorpay?.keySecret ?? '');
        const integration = await connectRazorpayIntegration(
          supabase,
          auth.userId,
          keyId,
          keySecret
        );
        return res.status(200).json({ integration, oauthUrl: null });
      }

      return res.status(400).json({ error: 'Unsupported provider connect request' });
    } catch (e) {
      console.error('integrations connect:', e);
      const msg =
        e instanceof ShiprocketApiError
          ? e.message
          : e instanceof RazorpayApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Could not connect integration';
      const status =
        (e instanceof ShiprocketApiError || e instanceof RazorpayApiError) &&
        e.status === 401
          ? 401
          : 500;
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

      if (provider === 'razorpay') {
        const integration = await refreshRazorpayIntegration(supabase, auth.userId);
        return res.status(200).json({ integration });
      }

      return res.status(400).json({ error: 'Unsupported provider refresh request' });
    } catch (e) {
      console.error('integrations refresh:', e);
      const msg =
        e instanceof ShiprocketApiError
          ? e.message
          : e instanceof RazorpayApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Could not refresh integration status';
      return res.status(500).json({ error: msg });
    }
  }

  if (key === 'shipments/create' && req.method === 'POST') {
    const body = (req.body ?? {}) as {
      orderId?: string;
      shippingAddress?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        pincode?: string;
        country?: string;
      };
    };
    const orderId = String(body.orderId ?? '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    try {
      const shipment = await createShiprocketShipmentForOrder(
        supabase,
        auth.userId,
        orderId,
        body.shippingAddress ?? null
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
