/**
 * Persisted Supabase auth user id (UUID) for localStorage keys and on-disk paths.
 */
const LS_SUPABASE_USER_ID = 'supabase_user_id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getPersistedAuthUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LS_SUPABASE_USER_ID);
}

/**
 * Read user id from Supabase JS v2 `sb-*-auth-token` localStorage entry.
 * Used when `supabase_user_id` was cleared but the session blob still exists (offline reload).
 */
export function tryGetSupabaseUserIdFromAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.includes('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const user =
        (parsed?.user as { id?: string } | undefined) ||
        (parsed?.currentSession as { user?: { id?: string } } | undefined)?.user;
      const id = user?.id;
      if (typeof id === 'string' && UUID_RE.test(id)) return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const PRODUCTS_LS_PREFIX = 'products::';

/**
 * When auth keys are missing but `products::<uuid>` rows exist (e.g. partial storage wipe),
 * recover the seller id from the largest non-empty keyed catalogue. Offline-only caller should
 * use this after persisted id + JWT blob checks fail.
 */
export function tryDiscoverCatalogueOwnerUserIdFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  let best: { uid: string; n: number } | null = null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PRODUCTS_LS_PREFIX)) continue;
      const suffix = key.slice(PRODUCTS_LS_PREFIX.length);
      if (!UUID_RE.test(suffix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let arr: unknown;
      try {
        arr = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(arr) || arr.length === 0) continue;
      if (!best || arr.length > best.n) best = { uid: suffix, n: arr.length };
    }
  } catch {
    /* ignore */
  }
  return best?.uid ?? null;
}
