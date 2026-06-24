import { getSupabaseAccessToken } from '../supabaseClient';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';

const API_FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${API_FETCH_TIMEOUT_MS / 1000}s. Check your connection or try again.`);
    }
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Network error. Check your connection and ensure VITE_BACKEND_URL is correct.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type CustomDomainVerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type CustomDomainStatus = 'pending' | 'active' | 'error' | null;

export type CustomDomainState = {
  configured: boolean;
  hostname: string | null;
  status: CustomDomainStatus;
  verified: boolean;
  verification: CustomDomainVerificationRecord[];
  /** Rows to show in the DNS table (includes fallbacks when Vercel omits verification). */
  dnsRecords?: CustomDomainVerificationRecord[];
  vercelError?: string | null;
  publicUrl?: string | null;
  storeSlug?: string;
  error?: string;
};

async function apiFetch(
  path: string,
  init: RequestInit & { method: string }
): Promise<CustomDomainState & { ok: boolean; httpStatus: number }> {
  const base = resolveApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      httpStatus: 0,
      configured: false,
      hostname: null,
      status: null,
      verified: false,
      verification: [],
      error: 'Missing API URL. Set VITE_BACKEND_URL to your deployed app.',
    };
  }

  let token: string | null = null;
  try {
    token = await Promise.race([
      getSupabaseAccessToken(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
  } catch {
    token = null;
  }
  if (!token) {
    return {
      ok: false,
      httpStatus: 401,
      configured: false,
      hostname: null,
      status: null,
      verified: false,
      verification: [],
      error: 'Sign in to manage your custom domain.',
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
    const msg = err instanceof Error ? err.message : 'Network error. Please check your connection.';
    console.error('Custom domain API error:', err);
    return {
      ok: false,
      httpStatus: 0,
      configured: false,
      hostname: null,
      status: null,
      verified: false,
      verification: [],
      error: msg,
    };
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      configured: res.status === 503 ? false : body.configured !== false,
      hostname: typeof body.hostname === 'string' ? body.hostname : null,
      status: (body.status as CustomDomainStatus) ?? null,
      verified: body.verified === true,
      verification: Array.isArray(body.verification)
        ? (body.verification as CustomDomainVerificationRecord[])
        : [],
      error: typeof body.error === 'string' ? body.error : `Request failed (${res.status})`,
    };
  }

  const verification = Array.isArray(body.verification)
    ? (body.verification as CustomDomainVerificationRecord[])
    : [];
  const dnsRecords = Array.isArray(body.dnsRecords)
    ? (body.dnsRecords as CustomDomainVerificationRecord[])
    : verification;

  return {
    ok: true,
    httpStatus: res.status,
    configured: body.configured !== false,
    hostname: typeof body.hostname === 'string' ? body.hostname : null,
    status: (body.status as CustomDomainStatus) ?? null,
    verified: body.verified === true,
    verification,
    dnsRecords,
    vercelError: typeof body.vercelError === 'string' ? body.vercelError : null,
    publicUrl: typeof body.publicUrl === 'string' ? body.publicUrl : null,
    storeSlug: typeof body.storeSlug === 'string' ? body.storeSlug : undefined,
  };
}

export async function fetchCustomDomainState(): Promise<CustomDomainState & { ok: boolean }> {
  const r = await apiFetch('/api/store-custom-domain', { method: 'GET' });
  return r;
}

export async function connectCustomDomain(hostname: string): Promise<CustomDomainState & { ok: boolean }> {
  return apiFetch('/api/store-custom-domain', {
    method: 'POST',
    body: JSON.stringify({ action: 'connect', hostname }),
  });
}

export async function refreshCustomDomainStatus(): Promise<CustomDomainState & { ok: boolean }> {
  return apiFetch('/api/store-custom-domain', {
    method: 'POST',
    body: JSON.stringify({ action: 'refresh' }),
  });
}

export async function disconnectCustomDomain(): Promise<{ ok: boolean; error?: string }> {
  const r = await apiFetch('/api/store-custom-domain', { method: 'DELETE' });
  return { ok: r.ok, error: r.error };
}
