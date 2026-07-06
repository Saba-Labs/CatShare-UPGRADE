import { INAPP_SKUS, SUBSCRIPTION_SKUS } from '../config/subscriptionSkus';

export type SubscriptionStatus = 'active' | 'expired' | 'canceled';

export interface UserSubscriptionInfo {
  platform: 'android' | 'ios';
  productId: string;
  status: SubscriptionStatus;
  expiresAt: string | null;
  /** First recorded subscription date (falls back to updatedAt when created_at is absent). */
  createdAt?: string;
  updatedAt: string;
}

export function subscriptionPlanLabel(productId: string): string {
  if (productId === SUBSCRIPTION_SKUS.monthly) return 'Pro Monthly';
  if (productId === SUBSCRIPTION_SKUS.yearly) return 'Pro Yearly';
  if (productId === INAPP_SKUS.lifetime) return 'Pro Lifetime';
  return 'Pro';
}

export function isLifetimeProduct(productId: string): boolean {
  return productId === INAPP_SKUS.lifetime;
}

export function formatSubscriptionDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });
  } catch {
    return iso;
  }
}

export function daysUntilDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const diff = new Date(iso).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export function subscriptionStatusLabel(
  sub: UserSubscriptionInfo | null | undefined,
  isPaidPro: boolean
): string {
  if (!sub) return isPaidPro ? 'Active' : 'None';
  if (isPaidPro && sub.status === 'active') return 'Active';
  if (sub.status === 'canceled') return 'Canceled';
  if (sub.status === 'expired') return 'Expired';
  if (sub.expiresAt && new Date(sub.expiresAt).getTime() <= Date.now()) return 'Expired';
  return sub.status === 'active' ? 'Active' : 'Inactive';
}

export function subscriptionBillingCycle(productId: string): string {
  if (productId === SUBSCRIPTION_SKUS.monthly) return 'Monthly';
  if (productId === SUBSCRIPTION_SKUS.yearly) return 'Yearly';
  if (productId === INAPP_SKUS.lifetime) return 'Lifetime (one-time)';
  return '—';
}

export function subscriptionPlatformLabel(platform: 'android' | 'ios'): string {
  return platform === 'android' ? 'Google Play' : 'App Store';
}

export function subscriptionAutoRenewLabel(productId: string, isPaidPro: boolean): string {
  if (!isPaidPro) return '—';
  if (isLifetimeProduct(productId)) return 'Not applicable';
  return 'Enabled via Google Play';
}

/** Estimate when the current billing period started from expiry + plan length. */
export function estimateCurrentPeriodStart(sub: UserSubscriptionInfo): string | null {
  if (!sub.expiresAt || isLifetimeProduct(sub.productId)) return null;
  try {
    const expires = new Date(sub.expiresAt);
    const start = new Date(expires);
    if (sub.productId === SUBSCRIPTION_SKUS.monthly) {
      start.setMonth(start.getMonth() - 1);
    } else if (sub.productId === SUBSCRIPTION_SKUS.yearly) {
      start.setFullYear(start.getFullYear() - 1);
    } else {
      return null;
    }
    return start.toISOString();
  } catch {
    return null;
  }
}

export function subscriptionSubscribedSinceLabel(sub: UserSubscriptionInfo | null | undefined): string {
  if (!sub) return '—';
  if (sub.createdAt) return formatSubscriptionDate(sub.createdAt);
  const periodStart = estimateCurrentPeriodStart(sub);
  if (periodStart) return formatSubscriptionDate(periodStart);
  return formatSubscriptionDate(sub.updatedAt);
}

export function formatSubscriptionDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function subscriptionPeriodProgress(
  sub: UserSubscriptionInfo | null | undefined
): { percent: number; daysLeft: number; totalDays: number } | null {
  if (!sub?.expiresAt || isLifetimeProduct(sub.productId)) return null;
  const daysLeft = daysUntilDate(sub.expiresAt);
  if (daysLeft == null || daysLeft < 0) return null;

  let totalDays = 30;
  if (sub.productId === SUBSCRIPTION_SKUS.yearly) totalDays = 365;

  const daysUsed = Math.max(0, totalDays - daysLeft);
  const percent = Math.min(100, Math.max(0, (daysUsed / totalDays) * 100));
  return { percent, daysLeft, totalDays };
}

export function subscriptionRenewalLabel(
  sub: UserSubscriptionInfo | null | undefined,
  isPaidPro: boolean
): string {
  if (!sub) return '—';
  if (isLifetimeProduct(sub.productId)) return 'Lifetime — no renewal';
  if (!sub.expiresAt) return isPaidPro ? 'Active subscription' : '—';
  const days = daysUntilDate(sub.expiresAt);
  if (isPaidPro && days != null && days > 0) {
    return `Renews on ${formatSubscriptionDate(sub.expiresAt)}`;
  }
  if (days != null && days <= 0) {
    return `Ended on ${formatSubscriptionDate(sub.expiresAt)}`;
  }
  return `Valid until ${formatSubscriptionDate(sub.expiresAt)}`;
}
