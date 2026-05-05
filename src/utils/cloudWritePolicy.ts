import { authService } from '../services/authService';

/** Shown when a logged-in cloud user tries to mutate while offline. */
export const OFFLINE_CLOUD_WRITE_TOAST =
  'Connect to the internet to make changes.';
export const SESSION_RESTORING_CLOUD_WRITE_TOAST =
  'Session is restoring. Please wait a moment.';
export const SESSION_EXPIRED_CLOUD_WRITE_TOAST =
  'Session expired. Please log in again.';

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
  user: { uid?: string; isAnonymous?: boolean; isSessionFallback?: boolean; sessionExpired?: boolean } | null | undefined,
  online: boolean = isBrowserOnline()
): boolean {
  return (
    isCloudSyncedAccount(user) &&
    (!online || user?.isSessionFallback === true || user?.sessionExpired === true)
  );
}

export function cloudWriteBlockedMessage(
  user: { isSessionFallback?: boolean; sessionExpired?: boolean } | null | undefined,
  online: boolean = isBrowserOnline()
): string {
  if (user?.sessionExpired) return SESSION_EXPIRED_CLOUD_WRITE_TOAST;
  if (user?.isSessionFallback) return SESSION_RESTORING_CLOUD_WRITE_TOAST;
  if (!online) return OFFLINE_CLOUD_WRITE_TOAST;
  return OFFLINE_CLOUD_WRITE_TOAST;
}
