/**
 * Shared Pro entitlement rules (trial + paid subscription).
 * Used by Vercel api/subscription and backend/server.js.
 */

/** Length of free Pro trial from account creation (days). */
export const TRIAL_DAYS = 14;

export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * @param {{ status?: string; expires_at?: string | null } | null} row
 * @returns {boolean}
 */
export function computePaidPro(row) {
  if (!row) return false;
  if (row.status !== "active") return false;
  if (row.expires_at == null || row.expires_at === "") return true; // lifetime
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * @param {string | undefined} createdAtIso - auth.users created_at
 * @returns {string} ISO timestamp when the free trial ends
 */
export function computeTrialEndsAtIso(createdAtIso) {
  const t = createdAtIso ? new Date(createdAtIso).getTime() : NaN;
  if (Number.isNaN(t)) {
    return new Date(Date.now() + TRIAL_MS).toISOString();
  }
  return new Date(t + TRIAL_MS).toISOString();
}

/**
 * @param {string} trialEndsAtIso
 * @param {number} [nowMs=Date.now()]
 */
export function isTrialPeriodActive(trialEndsAtIso, nowMs = Date.now()) {
  if (!trialEndsAtIso) return false;
  return new Date(trialEndsAtIso).getTime() > nowMs;
}

/**
 * @param {{ paidPro: boolean; trialEndsAtIso: string }} p
 */
export function computeHasProAccess({ paidPro, trialEndsAtIso }) {
  if (paidPro) return true;
  return isTrialPeriodActive(trialEndsAtIso);
}
