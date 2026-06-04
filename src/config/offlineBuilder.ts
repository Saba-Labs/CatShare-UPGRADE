/**
 * Offline / degraded-Supabase mode for the website homepage builder.
 * Set VITE_USE_LOCAL_HOMEPAGE_STORE=true to keep editor drafts in localStorage.
 * Set VITE_OFFLINE_BUILDER=true to skip cloud profile fetches while building.
 * Public storefronts always load published layout from Supabase.
 */
import { USE_LOCAL_HOMEPAGE_STORE } from '../services/homepageService';

export { USE_LOCAL_HOMEPAGE_STORE };

/** True when the builder should not wait on Supabase for saves or profile sync. */
export function isOfflineBuilderMode(): boolean {
  if (USE_LOCAL_HOMEPAGE_STORE) return true;
  return String(import.meta.env.VITE_OFFLINE_BUILDER || '').toLowerCase() === 'true';
}

/** Per-attempt cap for getSession(); retried in getSessionWithTimeout. */
export const SUPABASE_SESSION_TIMEOUT_MS = 12_000;
export const SUPABASE_PROFILE_FETCH_TIMEOUT_MS = 18_000;
/** Cold-start budget before showing cached identity while session retries continue. */
export const AUTH_INIT_MAX_MS = 18_000;
/** Background retry while restoring session after fallback identity. */
export const SESSION_RECOVERY_INTERVAL_MS = 4_000;

export function isHomepageEditorPath(pathname: string): boolean {
  return pathname === '/store/homepage' || pathname.startsWith('/store/homepage/');
}
