/**
 * Single Supabase browser client. Session JWT is sent automatically on requests
 * so RLS policies using auth.uid() work when user_id matches auth.users(id).
 */
import { createClient, SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import { SUPABASE_SESSION_TIMEOUT_MS } from './config/offlineBuilder';
import { isSupabaseAuthFatalError } from './utils/sessionAuthErrors';
import { getSessionWithTimeout } from './utils/supabaseSession';
import {
  getStoredAuthUserFromLocalStorage,
  parseSupabaseAuthBlobFromLocalStorage,
  sessionFromAuthBlob,
} from './utils/supabaseAuthStorage';

const HYDRATE_SET_SESSION_MS = 6_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Dispatched after backup restore re-applies Supabase auth keys so AuthContext can re-sync. */
export const CATSHARE_AUTH_RESTORED_EVENT = 'catshare:supabase-auth-restored';
/** Dispatched when a full cloud profile fetch succeeds — clears reconnecting without getSession(). */
export const CATSHARE_CLOUD_FETCH_OK_EVENT = 'catshare:cloud-fetch-ok';

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
/**
 * Load tokens from localStorage into the Supabase client (avoids getSession() hangs).
 * Returns the active session when hydration succeeds.
 */
/** User from localStorage auth blob — never blocks on Supabase client. */
export function getAuthUserFromLocalStorage(expectedUid?: string): User | null {
  return getStoredAuthUserFromLocalStorage(expectedUid);
}

export async function hydrateAuthSessionFromLocalStorage(): Promise<Session | null> {
  const blob = parseSupabaseAuthBlobFromLocalStorage();
  if (!blob) return null;

  const fallbackSession = sessionFromAuthBlob(blob);

  try {
    if (!blob.refresh_token) {
      return fallbackSession;
    }
    const { data, error } = await Promise.race([
      supabase.auth.setSession({
        access_token: blob.access_token,
        refresh_token: blob.refresh_token,
      }),
      sleep(HYDRATE_SET_SESSION_MS).then(() => ({
        data: { session: null as Session | null, user: null as User | null },
        error: null,
      })),
    ]);
    if (!error && data.session?.user) return data.session;
    if (error && isSupabaseAuthFatalError(error)) return null;
  } catch (err) {
    if (isSupabaseAuthFatalError(err)) return null;
  }

  try {
    const {
      data: { session },
    } = await Promise.race([
      supabase.auth.getSession(),
      sleep(2_000).then(() => ({ data: { session: null as Session | null } })),
    ]);
    if (session?.user) return session;
  } catch {
    /* ignore */
  }

  return fallbackSession;
}

export async function refreshSupabaseSessionFromStorage(): Promise<boolean> {
  try {
    const hydrated = await hydrateAuthSessionFromLocalStorage();
    if (hydrated?.access_token) return true;
    const {
      data: { session },
    } = await getSessionWithTimeout(SUPABASE_SESSION_TIMEOUT_MS, 0);
    if (session?.access_token) return true;
    const { data: refreshed } = await supabase.auth.refreshSession();
    return !!refreshed.session?.access_token;
  } catch {
    return false;
  }
}

export type SessionRecoveryResult = {
  session: Session | null;
  /** True only when refresh token is invalid — user must sign in again. */
  authInvalid: boolean;
};

/**
 * Re-resolve session after transient null (storage race, backup restore, token refresh timing).
 * Distinguishes network/timeouts (authInvalid=false) from revoked refresh tokens.
 */
export async function recoverSupabaseSession(): Promise<SessionRecoveryResult> {
  const tryOnce = async (): Promise<SessionRecoveryResult> => {
    const blob = parseSupabaseAuthBlobFromLocalStorage();
    if (blob?.user) {
      return { session: sessionFromAuthBlob(blob), authInvalid: false };
    }
    try {
      const hydrated = await hydrateAuthSessionFromLocalStorage();
      if (hydrated?.user) return { session: hydrated, authInvalid: false };
    } catch {
      /* ignore */
    }
    try {
      const {
        data: { session },
      } = await getSessionWithTimeout(SUPABASE_SESSION_TIMEOUT_MS, 1);
      if (session?.user) return { session, authInvalid: false };
    } catch {
      /* ignore */
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { session: null, authInvalid: false };
    }
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.user) {
        return { session: data.session, authInvalid: false };
      }
      if (error && isSupabaseAuthFatalError(error)) {
        return { session: null, authInvalid: true };
      }
    } catch (err) {
      if (isSupabaseAuthFatalError(err)) {
        return { session: null, authInvalid: true };
      }
    }
    return { session: null, authInvalid: false };
  };

  const first = await tryOnce();
  if (first.session || first.authInvalid) return first;
  await new Promise((r) => setTimeout(r, 200));
  return tryOnce();
}

/** @deprecated Use persistAuthUserIdsForStorage — kept for any stray imports */
export function setSupabaseUser(userId: string | null | undefined): void {
  persistAuthUserIdsForStorage(userId);
}
