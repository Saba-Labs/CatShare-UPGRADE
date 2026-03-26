/**
 * Persisted Supabase auth user id (UUID) for localStorage keys and on-disk paths.
 */
const LS_SUPABASE_USER_ID = 'supabase_user_id';

export function getPersistedAuthUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LS_SUPABASE_USER_ID);
}
