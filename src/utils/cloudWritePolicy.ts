import { authService } from '../services/authService';

/** Shown when a logged-in cloud user tries to mutate while offline. */
export const OFFLINE_CLOUD_WRITE_TOAST =
  'Connect to the internet to make changes.';
export const SESSION_RESTORING_CLOUD_WRITE_TOAST =
  'Reconnecting… Editing will resume when your connection is stable.';
export const SESSION_EXPIRED_CLOUD_WRITE_TOAST =
  'Sign-in required. Please log in again to sync changes.';

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

/** View-only / no cloud writes: offline, reconnecting, or auth invalid. */
export function isSessionReconnecting(
  user: { isSessionFallback?: boolean; sessionExpired?: boolean } | null | undefined
): boolean {
  return user?.isSessionFallback === true && user?.sessionExpired !== true;
}

/** True when this user must not perform cloud-backed writes. */
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
