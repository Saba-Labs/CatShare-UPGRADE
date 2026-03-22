/**
 * Single Supabase browser client. Session JWT is sent automatically on requests
 * so RLS policies using auth.uid() work when user_id matches auth.users(id).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[CatShare] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local and rebuild.'
  );
}

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
  }
);

/** Use this everywhere we previously called getSupabaseClient() — one client, session attached. */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

/**
 * After login, keep legacy keys in sync so existing code using firebaseUserId / supabase_user_id still works.
 * Values are the Supabase auth user UUID (same as JWT sub).
 */
export function persistAuthUserIdsForStorage(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem('supabase_user_id', userId);
    localStorage.setItem('firebaseUserId', userId);
  } catch {
    /* ignore */
  }
}

export function clearAuthUserIdsFromStorage(): void {
  try {
    localStorage.removeItem('supabase_user_id');
    localStorage.removeItem('firebaseUserId');
  } catch {
    /* ignore */
  }
}

/** Bearer token for Vercel APIs (R2, subscription, etc.) */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** @deprecated Use persistAuthUserIdsForStorage — kept for any stray imports */
export function setSupabaseUser(userId: string | null | undefined): void {
  persistAuthUserIdsForStorage(userId);
}
