import { TRIAL_DAYS_UI_FALLBACK } from '../config/freeTierLimits';
import type { UserSubscriptionInfo } from './subscriptionDisplay';

export const LS_IS_PRO = 'isPro';
export const LS_TRIAL_ENDS = 'subscription_trialEndsAt';
export const LS_TRIAL_ACTIVE = 'subscription_isTrialActive';
export const LS_PAID_PRO = 'subscription_isPaidPro';
export const LS_TRIAL_DAYS = 'subscription_trialDays';
export const LS_CACHED_UID = 'subscription_cachedUid';
export const LS_SUBSCRIPTION_SNAPSHOT = 'subscription_snapshot';

export type CachedEntitlement = {
  isPro: boolean;
  isPaidPro: boolean;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  trialDays: number;
  subscription: UserSubscriptionInfo | null;
};

function readTrialDays(): number {
  const raw = localStorage.getItem(LS_TRIAL_DAYS);
  if (raw == null || raw === '') return TRIAL_DAYS_UI_FALLBACK;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : TRIAL_DAYS_UI_FALLBACK;
}

function readSubscriptionSnapshot(): UserSubscriptionInfo | null {
  const raw = localStorage.getItem(LS_SUBSCRIPTION_SNAPSHOT);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserSubscriptionInfo;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether cached entitlement keys belong to this signed-in user. */
export function cacheMatchesUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const cachedUid = localStorage.getItem(LS_CACHED_UID);
  if (cachedUid) return cachedUid === userId;

  // Legacy installs only persisted isPro without subscription_cachedUid.
  const persistedUid =
    localStorage.getItem('supabase_user_id') ||
    localStorage.getItem('userId') ||
    '';
  if (!persistedUid) return localStorage.getItem(LS_IS_PRO) !== null;
  return persistedUid === userId;
}

export function readCachedEntitlement(userId: string | null | undefined): CachedEntitlement | null {
  if (!userId || !cacheMatchesUser(userId)) return null;

  const trialEndsRaw = localStorage.getItem(LS_TRIAL_ENDS);
  return {
    isPro: localStorage.getItem(LS_IS_PRO) === 'true',
    isPaidPro: localStorage.getItem(LS_PAID_PRO) === 'true',
    isTrialActive: localStorage.getItem(LS_TRIAL_ACTIVE) === 'true',
    trialEndsAt: trialEndsRaw && trialEndsRaw.length > 0 ? trialEndsRaw : null,
    trialDays: readTrialDays(),
    subscription: readSubscriptionSnapshot(),
  };
}

export function writeCachedEntitlement(
  userId: string,
  entitlement: CachedEntitlement
): void {
  localStorage.setItem(LS_CACHED_UID, userId);
  localStorage.setItem(LS_IS_PRO, entitlement.isPro ? 'true' : 'false');
  localStorage.setItem(LS_PAID_PRO, entitlement.isPaidPro ? 'true' : 'false');
  localStorage.setItem(LS_TRIAL_ACTIVE, entitlement.isTrialActive ? 'true' : 'false');
  localStorage.setItem(LS_TRIAL_DAYS, String(entitlement.trialDays));

  if (entitlement.trialEndsAt) {
    localStorage.setItem(LS_TRIAL_ENDS, entitlement.trialEndsAt);
  } else {
    localStorage.removeItem(LS_TRIAL_ENDS);
  }

  if (entitlement.subscription) {
    localStorage.setItem(LS_SUBSCRIPTION_SNAPSHOT, JSON.stringify(entitlement.subscription));
  } else {
    localStorage.removeItem(LS_SUBSCRIPTION_SNAPSHOT);
  }
}

export function clearCachedEntitlement(): void {
  localStorage.setItem(LS_IS_PRO, 'false');
  localStorage.removeItem(LS_TRIAL_ENDS);
  localStorage.setItem(LS_TRIAL_ACTIVE, 'false');
  localStorage.setItem(LS_PAID_PRO, 'false');
  localStorage.removeItem(LS_TRIAL_DAYS);
  localStorage.removeItem(LS_CACHED_UID);
  localStorage.removeItem(LS_SUBSCRIPTION_SNAPSHOT);
}
