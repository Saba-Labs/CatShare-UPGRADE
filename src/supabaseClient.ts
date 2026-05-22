/**
 * Single Supabase browser client. Session JWT is sent automatically on requests
 * so RLS policies using auth.uid() work when user_id matches auth.users(id).
 */
import { createClient, SupabaseClient, type Session } from '@supabase/supabase-js';

/** Dispatched after backup restore re-applies Supabase auth keys so AuthContext can re-sync. */
export const CATSHARE_AUTH_RESTORED_EVENT = 'catshare:supabase-auth-restored';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

console.log('[Supabase Init]', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  allEnv: Object.keys(import.meta.env).filter(k => k.includes('SUPABASE'))
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[CatShare] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local and rebuild.',
    'URL:', supabaseUrl,
    'KEY:', supabaseAnonKey ? 'present' : 'missing'
  );
}

/**
 * Some RLS policies (see SUPABASE_SHARE_LINKS_SQL.md) compare `seller_user_id` to the
 * `x-user-id` request header. The anon JWT alone does not set that header — we attach it
 * from the signed-in Supabase user id (AuthContext keeps this in sync).
 */
let rlsUserIdForRequestHeaders: string | null = null;

export function setSupabaseRlsUserId(userId: string | null | undefined): void {
  rlsUserIdForRequestHeaders = userId || null;
}

const supabaseFetch: typeof fetch = (input, init) => {
  // Create headers from existing headers or empty object
  const headers = new Headers(init?.headers || {});
  if (rlsUserIdForRequestHeaders) {
    headers.set('x-user-id', rlsUserIdForRequestHeaders);
  }
  // Spread init but exclude headers, then add our merged headers
  const { headers: _, ...restInit } = init || {};

  // Log fetch requests for debugging
  if (typeof input === 'string' && input.includes('store_homepage_configs')) {
    console.log('[supabaseFetch]', input, 'headers:', Object.fromEntries(headers));
  }

  /** Avoid stale browser HTTP cache on PostgREST/RPC (important for public storefront). */
  return fetch(input, { ...restInit, headers, cache: 'no-store' }).catch(err => {
    console.error('[supabaseFetch] Error:', err, 'URL:', input);
    throw err;
  });
};

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      fetch: supabaseFetch,
    },
  }
);

// Test Supabase connectivity on init
if (supabaseUrl) {
  fetch(supabaseUrl, { method: 'HEAD', mode: 'no-cors' }).then(
    () => console.log('[Supabase] Connectivity test passed'),
    (err) => console.log('[Supabase] Connectivity test failed:', err.message)
  );
}

/** Use this everywhere we previously called getSupabaseClient() — one client, session attached. */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

/**
 * After Supabase login, persist the auth user UUID for storage keys and paths.
 */
export function persistAuthUserIdsForStorage(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem('supabase_user_id', userId);
  } catch {
    /* ignore */
  }
}

export function clearAuthUserIdsFromStorage(): void {
  try {
    localStorage.removeItem('supabase_user_id');
  } catch {
    /* ignore */
  }
}

/** Bearer token for Vercel APIs (R2, subscription, etc.) */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Supabase JS v2 stores session under keys prefixed with `sb-`. */
const SUPABASE_AUTH_LS_PREFIX = 'sb-';

/** Snapshot before `localStorage.clear()` so restore flows keep the user logged in for RLS. */
export function snapshotSupabaseAuthFromLocalStorage(): Record<string, string> {
  const snap: Record<string, string> = {};
  if (typeof window === 'undefined' || !window.localStorage) return snap;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SUPABASE_AUTH_LS_PREFIX)) {
        const v = localStorage.getItem(key);
        if (v !== null) snap[key] = v;
      }
    }
  } catch {
    /* ignore */
  }
  return snap;
}

/** Put session keys back after clear + app data restore. */
export function restoreSupabaseAuthToLocalStorage(snapshot: Record<string, string>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    Object.entries(snapshot).forEach(([k, v]) => {
      localStorage.setItem(k, v);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Re-read session from storage into the client after manual localStorage writes.
 * Returns whether a user access token is available for REST calls.
 */
export async function refreshSupabaseSessionFromStorage(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return true;
    const { data: refreshed } = await supabase.auth.refreshSession();
    return !!refreshed.session?.access_token;
  } catch {
    return false;
  }
}

/**
 * Re-resolve session after transient null (storage race, backup restore, token refresh timing).
 * If tokens are revoked or the user signed out, returns null.
 */
export async function recoverSupabaseSession(): Promise<Session | null> {
  const tryOnce = async (): Promise<Session | null> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) return session;
    } catch {
      /* ignore */
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.user) return data.session;
    } catch {
      /* ignore */
    }
    return null;
  };

  const first = await tryOnce();
  if (first) return first;
  await new Promise((r) => setTimeout(r, 120));
  return tryOnce();
}

/** @deprecated Use persistAuthUserIdsForStorage — kept for any stray imports */
export function setSupabaseUser(userId: string | null | undefined): void {
  persistAuthUserIdsForStorage(userId);
}
