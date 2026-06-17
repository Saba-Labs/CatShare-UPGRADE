/**
 * Dev / preview middleware router for /api/integrations/* (localhost Vite).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUserFromRequest } from './supabaseAuthRequest.js';
import {
  deleteIntegration,
  isValidProvider,
  listIntegrations,
  stubRazorpayMetadata,
  upsertIntegration,
  type IntegrationProviderId,
} from './integrationsServer.js';
import { connectShiprocketIntegration, createShiprocketShipmentForOrder, refreshShiprocketIntegration } from './shiprocketIntegration.js';
import { connectRazorpayIntegration, refreshRazorpayIntegration } from './razorpayIntegration.js';
import { ShiprocketApiError } from './shiprocketServer.js';
import { RazorpayApiError } from './razorpayServer.js';
import { syncStoreIntegrationFlags } from './storeIntegrationFlags.js';

export type DevIntegrationsEnv = {
  supabaseUrl: string;
  supabaseServiceKey: string;
};

function createServiceSupabase(env: DevIntegrationsEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceKey);
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>
): { status: number; body: Record<string, unknown> } {
  return { status, body };
}

export async function handleDevIntegrationsRequest(
  method: string,
  path: string,
  authHeader: string | undefined,
  body: Record<string, unknown>,
  env: DevIntegrationsEnv
): Promise<{ status: number; body: Record<string, unknown> }> {
  process.env.SUPABASE_URL = env.supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.supabaseServiceKey;

  const auth = await getSupabaseUserFromRequest(authHeader);
  if (auth.ok === false) {
    return jsonResponse(401, { error: auth.error });
  }

  const supabase = createServiceSupabase(env);

  if (path === '/api/integrations' && method === 'GET') {
    try {
      const integrations = await listIntegrations(supabase, auth.userId);
      await syncStoreIntegrationFlags(supabase, auth.userId).catch(() => undefined);
      return jsonResponse(200, { integrations });
    } catch (e) {
      return jsonResponse(500, { error: 'Could not load integrations' });
    }
  }

  if (path === '/api/integrations/connect' && method === 'POST') {
    const provider = String(body.provider ?? '').trim();
    if (!isValidProvider(provider)) {
      return jsonResponse(400, { error: 'Invalid provider' });
    }
    try {
      if (provider === 'shiprocket') {
        const email = String((body.shiprocket as { email?: string })?.email ?? '').trim();
        const password = String((body.shiprocket as { password?: string })?.password ?? '');
        const integration = await connectShiprocketIntegration(
          supabase,
          auth.userId,
          email,
          password
        );
        return jsonResponse(200, { integration, oauthUrl: null });
      }
      if (provider === 'razorpay') {
        const keyId = String((body.razorpay as { keyId?: string })?.keyId ?? '').trim();
        const keySecret = String((body.razorpay as { keySecret?: string })?.keySecret ?? '');
        const integration = await connectRazorpayIntegration(
          supabase,
          auth.userId,
          keyId,
          keySecret
        );
        return jsonResponse(200, { integration, oauthUrl: null });
      }
      return jsonResponse(400, { error: 'Unsupported provider connect request' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not connect integration';
      const status =
        (e instanceof ShiprocketApiError || e instanceof RazorpayApiError) && e.status === 401
          ? 401
          : 500;
      return jsonResponse(status, { error: msg });
    }
  }

  if (path === '/api/integrations/disconnect' && method === 'POST') {
    const provider = String(body.provider ?? '').trim();
    if (!isValidProvider(provider)) {
      return jsonResponse(400, { error: 'Invalid provider' });
    }
    try {
      await deleteIntegration(supabase, auth.userId, provider as IntegrationProviderId);
      return jsonResponse(200, { success: true });
    } catch {
      return jsonResponse(500, { error: 'Could not disconnect integration' });
    }
  }

  if (path === '/api/integrations/refresh' && method === 'POST') {
    const provider = String(body.provider ?? '').trim();
    if (!isValidProvider(provider)) {
      return jsonResponse(400, { error: 'Invalid provider' });
    }
    try {
      if (provider === 'shiprocket') {
        const integration = await refreshShiprocketIntegration(supabase, auth.userId);
        return jsonResponse(200, { integration });
      }
      if (provider === 'razorpay') {
        const integration = await refreshRazorpayIntegration(supabase, auth.userId);
        return jsonResponse(200, { integration });
      }
      return jsonResponse(400, { error: 'Refresh not supported for this provider' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not refresh integration status';
      return jsonResponse(500, { error: msg });
    }
  }

  if (path === '/api/integrations/shipments/create' && method === 'POST') {
    const orderId = String(body.orderId ?? '').trim();
    if (!orderId) {
      return jsonResponse(400, { error: 'orderId is required' });
    }
    try {
      const shipment = await createShiprocketShipmentForOrder(
        supabase,
        auth.userId,
        orderId,
        body.shippingAddress ?? null
      );
      return jsonResponse(200, { shipment });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create shipment';
      const status =
        msg.includes('not found') ||
        msg.includes('delivery address') ||
        msg.includes('Connect Shiprocket')
          ? 400
          : 500;
      return jsonResponse(status, { error: msg });
    }
  }

  return jsonResponse(404, { error: 'Not found' });
}
