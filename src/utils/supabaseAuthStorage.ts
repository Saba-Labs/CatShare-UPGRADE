import type { Session, User } from '@supabase/supabase-js';

const SUPABASE_AUTH_LS_PREFIX = 'sb-';

type ParsedAuthBlob = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: User;
};

/** Read Supabase v2 `sb-*-auth-token` from localStorage without calling getSession(). */
export function parseSupabaseAuthBlobFromLocalStorage(): ParsedAuthBlob | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SUPABASE_AUTH_LS_PREFIX) || !key.includes('auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const access_token =
        (typeof parsed.access_token === 'string' && parsed.access_token) ||
        (typeof (parsed as { currentSession?: { access_token?: string } }).currentSession?.access_token ===
          'string' &&
          (parsed as { currentSession: { access_token: string } }).currentSession.access_token) ||
        '';
      const refresh_token =
        (typeof parsed.refresh_token === 'string' && parsed.refresh_token) ||
        (typeof (parsed as { currentSession?: { refresh_token?: string } }).currentSession?.refresh_token ===
          'string' &&
          (parsed as { currentSession: { refresh_token: string } }).currentSession.refresh_token) ||
        '';
      const user =
        (parsed.user as User | undefined) ||
        ((parsed as { currentSession?: { user?: User } }).currentSession?.user as User | undefined);
      if (!access_token || !user?.id) continue;

      const expires_at =
        typeof parsed.expires_at === 'number'
          ? parsed.expires_at
          : typeof (parsed as { expires_at?: number }).expires_at === 'number'
            ? (parsed as { expires_at: number }).expires_at
            : undefined;

      return { access_token, refresh_token, expires_at, user };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function sessionFromAuthBlob(blob: ParsedAuthBlob): Session {
  return {
    access_token: blob.access_token,
    refresh_token: blob.refresh_token,
    expires_in: blob.expires_at ? Math.max(0, blob.expires_at - Math.floor(Date.now() / 1000)) : 3600,
    expires_at: blob.expires_at,
    token_type: 'bearer',
    user: blob.user,
  } as Session;
}

/** Synchronous read — use to exit reconnecting without waiting on getSession()/setSession(). */
export function getStoredAuthUserFromLocalStorage(expectedUid?: string): User | null {
  const blob = parseSupabaseAuthBlobFromLocalStorage();
  if (!blob?.user?.id) return null;
  if (expectedUid && blob.user.id !== expectedUid) return null;
  return blob.user;
}
