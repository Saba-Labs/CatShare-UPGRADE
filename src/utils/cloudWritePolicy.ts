import { authService } from '../services/authService';

/** Shown when a logged-in cloud user tries to mutate while offline. */
export const OFFLINE_CLOUD_WRITE_TOAST =
  'Connect to the internet to make changes.';

export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/** Real Supabase account (not guest / anonymous). */
export function isCloudSyncedAccount(
  user: { uid?: string; isAnonymous?: boolean } | null | undefined
): boolean {
  return Boolean(
    user?.uid &&
      !user.isAnonymous &&
      !authService.isOfflineGuest()
  );
}

/** True when this user must not perform cloud-backed writes while offline. */
export function cloudWriteWouldBeBlocked(
  user: { uid?: string; isAnonymous?: boolean } | null | undefined,
  online: boolean = isBrowserOnline()
): boolean {
  return isCloudSyncedAccount(user) && !online;
}
