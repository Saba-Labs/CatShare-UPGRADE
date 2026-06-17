/**

 * Client API for integration connect/disconnect/refresh (Vercel /api/integrations/*).

 */

import { getSupabaseAccessToken } from '../../supabaseClient';

import { resolveApiBaseUrl } from '../../utils/apiBaseUrl';

import type { IntegrationConnectOptions, IntegrationProviderId } from '../core/types';

import type { SellerIntegrationRow } from './sellerIntegrationsService';

import {

  connectIntegrationClient,

  disconnectIntegrationClient,

  refreshIntegrationClient,

} from './integrationMutationsClient';



const API_FETCH_TIMEOUT_MS = 30_000;



function isLocalDevOrigin(origin: string): boolean {

  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

}



function requiresServerApi(provider: IntegrationProviderId): boolean {
  return provider === 'shiprocket' || provider === 'razorpay';

}



function preferDirectSupabaseMutations(provider: IntegrationProviderId): boolean {

  if (requiresServerApi(provider)) return false;

  return String(import.meta.env.VITE_INTEGRATIONS_API || '').trim() !== 'true';

}



function resolveIntegrationsApiBase(): string {

  if (typeof window !== 'undefined' && isLocalDevOrigin(window.location.origin)) {

    return window.location.origin;

  }

  return resolveApiBaseUrl();

}



function shouldFallbackToClient(

  provider: IntegrationProviderId,

  error: unknown,

  httpStatus: number

): boolean {

  if (requiresServerApi(provider)) return false;

  if (httpStatus === 0) return true;

  const msg = typeof error === 'string' ? error : '';

  return (

    msg.includes('Failed to fetch') ||

    msg.includes('Network error') ||

    msg.includes('Missing API URL')

  );

}



async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);

  try {

    return await fetch(url, { ...init, signal: controller.signal });

  } catch (err) {

    if (err instanceof Error && err.name === 'AbortError') {

      throw new Error('Request timed out. Check your connection or VITE_BACKEND_URL.');

    }

    throw err;

  } finally {

    clearTimeout(timer);

  }

}



export type IntegrationApiRow = SellerIntegrationRow;



export type IntegrationListResponse = {

  data: IntegrationApiRow[] | null;

  error: string | null;

};



export type IntegrationMutationResponse = {

  data: IntegrationApiRow | null;

  error: string | null;

  oauthUrl?: string | null;

};



async function getAuthToken(): Promise<string | null> {

  try {

    return await Promise.race([

      getSupabaseAccessToken(),

      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),

    ]);

  } catch {

    return null;

  }

}



async function apiJson(

  path: string,

  init: RequestInit & { method: string }

): Promise<Record<string, unknown> & { ok: boolean; httpStatus: number }> {

  const base = resolveIntegrationsApiBase();

  if (!base) {

    return {

      ok: false,

      httpStatus: 0,

      error: requiresServerApi('shiprocket')

        ? 'Missing API URL. On mobile set VITE_BACKEND_URL; on localhost restart the dev server.'

        : 'Missing API URL. Set VITE_BACKEND_URL to your deployed app.',

    };

  }



  const token = await getAuthToken();

  if (!token) {

    return {

      ok: false,

      httpStatus: 401,

      error: 'Sign in to manage integrations.',

    };

  }



  let res: Response;

  try {

    res = await fetchWithTimeout(`${base}${path}`, {

      ...init,

      headers: {

        'Content-Type': 'application/json',

        Authorization: `Bearer ${token}`,

        ...(init.headers as Record<string, string> | undefined),

      },

    });

  } catch (err) {

    const msg = err instanceof Error ? err.message : 'Network error';

    return { ok: false, httpStatus: 0, error: msg };

  }



  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {

    return {

      ok: false,

      httpStatus: res.status,

      error:

        typeof body.error === 'string'

          ? body.error

          : `Request failed (${res.status})`,

      ...body,

    };

  }



  return { ok: true, httpStatus: res.status, ...body };

}



export async function apiListIntegrations(

  _sellerUserId: string

): Promise<IntegrationListResponse> {

  const r = await apiJson('/api/integrations', { method: 'GET' });

  if (!r.ok) {

    return {

      data: null,

      error: typeof r.error === 'string' ? r.error : 'Failed to load integrations',

    };

  }

  return {

    data: Array.isArray(r.integrations)

      ? (r.integrations as IntegrationApiRow[])

      : [],

    error: null,

  };

}



export async function apiConnectIntegration(

  sellerUserId: string,

  provider: IntegrationProviderId,

  options?: IntegrationConnectOptions

): Promise<IntegrationMutationResponse> {

  if (preferDirectSupabaseMutations(provider)) {

    const direct = await connectIntegrationClient(sellerUserId, provider);

    return { data: direct.data, error: direct.error, oauthUrl: null };

  }



  const payload: Record<string, unknown> = { provider };

  if (provider === 'razorpay' && options?.razorpay) {
    payload.razorpay = options.razorpay;
  }
  if (provider === 'shiprocket' && options?.shiprocket) {

    payload.shiprocket = options.shiprocket;

  }



  const r = await apiJson('/api/integrations/connect', {

    method: 'POST',

    body: JSON.stringify(payload),

  });

  if (!r.ok) {

    if (shouldFallbackToClient(provider, r.error, r.httpStatus)) {

      const direct = await connectIntegrationClient(sellerUserId, provider);

      return {

        data: direct.data,

        error: direct.error,

        oauthUrl: null,

      };

    }

    return {

      data: null,

      error: typeof r.error === 'string' ? r.error : 'Connect failed',

    };

  }

  return {

    data: (r.integration as IntegrationApiRow) ?? null,

    oauthUrl: typeof r.oauthUrl === 'string' ? r.oauthUrl : null,

    error: null,

  };

}



export async function apiDisconnectIntegration(

  sellerUserId: string,

  provider: IntegrationProviderId

): Promise<{ error: string | null }> {

  if (preferDirectSupabaseMutations(provider)) {

    return disconnectIntegrationClient(sellerUserId, provider);

  }



  const r = await apiJson('/api/integrations/disconnect', {

    method: 'POST',

    body: JSON.stringify({ provider }),

  });

  if (!r.ok) {
    const msg = typeof r.error === 'string' ? r.error : '';
    if (
      (provider === 'shiprocket' || provider === 'razorpay') &&
      (r.httpStatus === 404 ||
        r.httpStatus === 0 ||
        msg.includes('Failed to fetch') ||
        msg.includes('Network error'))
    ) {
      return disconnectIntegrationClient(sellerUserId, provider);
    }

    if (shouldFallbackToClient(provider, r.error, r.httpStatus)) {

      return disconnectIntegrationClient(sellerUserId, provider);

    }

    return {

      error: typeof r.error === 'string' ? r.error : 'Disconnect failed',

    };

  }

  return { error: null };

}



export async function apiRefreshIntegration(

  sellerUserId: string,

  provider: IntegrationProviderId

): Promise<IntegrationMutationResponse> {

  if (preferDirectSupabaseMutations(provider)) {

    const direct = await refreshIntegrationClient(sellerUserId, provider);

    return { data: direct.data, error: direct.error };

  }



  const r = await apiJson('/api/integrations/refresh', {

    method: 'POST',

    body: JSON.stringify({ provider }),

  });

  if (!r.ok) {

    if (shouldFallbackToClient(provider, r.error, r.httpStatus)) {

      const direct = await refreshIntegrationClient(sellerUserId, provider);

      return { data: direct.data, error: direct.error };

    }

    return {

      data: null,

      error: typeof r.error === 'string' ? r.error : 'Refresh failed',

    };

  }

  return {

    data: (r.integration as IntegrationApiRow) ?? null,

    error: null,

  };

}



export async function apiCreateOrderShipment(

  orderId: string

): Promise<{ data: Record<string, unknown> | null; error: string | null }> {

  const r = await apiJson('/api/integrations/shipments/create', {

    method: 'POST',

    body: JSON.stringify({ orderId }),

  });

  if (!r.ok) {

    return {

      data: null,

      error: typeof r.error === 'string' ? r.error : 'Could not create shipment',

    };

  }

  return {

    data: (r.shipment as Record<string, unknown>) ?? null,

    error: null,

  };

}


