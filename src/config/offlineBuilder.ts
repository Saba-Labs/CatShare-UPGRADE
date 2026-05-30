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

export const SUPABASE_SESSION_TIMEOUT_MS = 5_000;
export const SUPABASE_PROFILE_FETCH_TIMEOUT_MS = 8_000;
export const AUTH_INIT_MAX_MS = 6_500;

export function isHomepageEditorPath(pathname: string): boolean {
  return pathname === '/store/homepage' || pathname.startsWith('/store/homepage/');
}
