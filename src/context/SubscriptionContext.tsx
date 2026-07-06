import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, getSupabaseAccessToken } from '../supabaseClient';
import { TRIAL_DAYS_UI_FALLBACK } from '../config/freeTierLimits';
import { useAuth } from './AuthContext';
import { getPersistedAuthUserId, tryGetSupabaseUserIdFromAuthToken } from '../utils/authUserId';
import type { UserSubscriptionInfo } from '../utils/subscriptionDisplay';

const LS_TRIAL_ENDS = 'subscription_trialEndsAt';
const LS_TRIAL_ACTIVE = 'subscription_isTrialActive';
const LS_PAID_PRO = 'subscription_isPaidPro';
const LS_TRIAL_DAYS = 'subscription_trialDays';
const LS_CACHED_UID = 'subscription_cachedUid';

type SubscriptionContextValue = {
  /** Full Pro access (paid subscription or active free trial). */
  isPro: boolean;
  /** Purchased subscription or lifetime (not trial-only). */
  isPaidPro: boolean;
  /** Free trial still active (Pro features via trial, no purchase yet). */
  isTrialActive: boolean;
  /** ISO date when the Pro trial ends (from account creation; length is `trialDays`). */
  trialEndsAt: string | null;
  /** Trial length in days from server (`/api/subscription`); use for UI copy. */
  trialDays: number;
  /** Paid subscription record from server (plan, expiry, status). */
  subscription: UserSubscriptionInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

function getCurrentAuthUserId(): string | null {
  return getPersistedAuthUserId() || tryGetSupabaseUserIdFromAuthToken();
}

function shouldUseCachedSubscription(): boolean {
  const cachedUid = localStorage.getItem(LS_CACHED_UID);
  const currentUid = getCurrentAuthUserId();
  if (cachedUid && currentUid) return cachedUid === currentUid;
  // Legacy cache (before per-user key): trust when signed-in and subscription keys exist.
  if (!cachedUid && currentUid) {
    return localStorage.getItem('isPro') !== null;
  }
  return false;
}

function readCachedTrialDays(): number {
  const raw = localStorage.getItem(LS_TRIAL_DAYS);
  if (raw == null || raw === '') return TRIAL_DAYS_UI_FALLBACK;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : TRIAL_DAYS_UI_FALLBACK;
}

const EMPTY_CACHED_TRIAL: Pick<
  SubscriptionContextValue,
  'trialEndsAt' | 'isTrialActive' | 'isPaidPro' | 'trialDays' | 'subscription'
> = {
  trialEndsAt: null,
  isTrialActive: false,
  isPaidPro: false,
  trialDays: TRIAL_DAYS_UI_FALLBACK,
  subscription: null,
};

function readCachedTrial(): Pick<
  SubscriptionContextValue,
  'trialEndsAt' | 'isTrialActive' | 'isPaidPro' | 'trialDays' | 'subscription'
> {
  if (!shouldUseCachedSubscription()) return EMPTY_CACHED_TRIAL;

  const trialEndsAt = localStorage.getItem(LS_TRIAL_ENDS);
  return {
    trialEndsAt: trialEndsAt && trialEndsAt.length > 0 ? trialEndsAt : null,
    isTrialActive: localStorage.getItem(LS_TRIAL_ACTIVE) === 'true',
    isPaidPro: localStorage.getItem(LS_PAID_PRO) === 'true',
    trialDays: readCachedTrialDays(),
    subscription: null,
  };
}

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [isPro, setIsPro] = useState<boolean>(() => {
    if (!shouldUseCachedSubscription()) return false;
    return localStorage.getItem('isPro') === 'true';
  });
  const [isPaidPro, setIsPaidPro] = useState<boolean>(() => readCachedTrial().isPaidPro);
  const [isTrialActive, setIsTrialActive] = useState<boolean>(() => readCachedTrial().isTrialActive);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(() => readCachedTrial().trialEndsAt);
  const [trialDays, setTrialDays] = useState<number>(() => readCachedTrial().trialDays);
  const [subscription, setSubscription] = useState<UserSubscriptionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const clearSubscriptionCache = useCallback(() => {
    setIsPro(false);
    setIsPaidPro(false);
    setIsTrialActive(false);
    setTrialEndsAt(null);
    setTrialDays(TRIAL_DAYS_UI_FALLBACK);
    setSubscription(null);
    localStorage.setItem('isPro', 'false');
    localStorage.removeItem(LS_TRIAL_ENDS);
    localStorage.setItem(LS_TRIAL_ACTIVE, 'false');
    localStorage.setItem(LS_PAID_PRO, 'false');
    localStorage.removeItem(LS_TRIAL_DAYS);
    localStorage.removeItem(LS_CACHED_UID);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Session may still be hydrating on cold start — keep cached entitlement.
        return;
      }

      const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
      // Skip subscription check if backend URL is not configured
      if (!baseUrl) {
        setLoading(false);
        return;
      }

      let accessToken: string | null = null;
      try {
        accessToken = await getSupabaseAccessToken();
      } catch (err) {
        console.debug('Failed to get access token:', err instanceof Error ? err.message : String(err));
        setLoading(false);
        return;
      }

      if (!accessToken) {
        setLoading(false);
        return;
      }

      // Create an AbortController with 5 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('timeout'), 5000);

      try {
        let resp: Response;
        try {
          resp = await fetch(`${baseUrl}/api/subscription`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          });
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          if (msg.includes('abort') || msg.includes('signal')) {
            console.debug('Subscription fetch timed out or was aborted');
          } else {
            console.debug('Subscription fetch failed:', msg);
          }
          clearTimeout(timeoutId);
          return;
        }

        if (!resp.ok) {
          console.debug(`Subscription API returned status ${resp.status}`);
          clearTimeout(timeoutId);
          return;
        }

        const json = await resp.json();
        const next = !!json?.isPro;
        const nextPaid = !!json?.isPaidPro;
        const nextTrial = !!json?.isTrialActive;
        const nextTrialEnd =
          typeof json?.trialEndsAt === 'string' && json.trialEndsAt.length > 0 ? json.trialEndsAt : null;
        const nextTrialDays =
          typeof json?.trialDays === 'number' && Number.isFinite(json.trialDays) && json.trialDays > 0
            ? json.trialDays
            : TRIAL_DAYS_UI_FALLBACK;
        const nextSubscription =
          json?.subscription && typeof json.subscription === 'object'
            ? ({
                platform: json.subscription.platform,
                productId: json.subscription.productId,
                status: json.subscription.status,
                expiresAt: json.subscription.expiresAt ?? null,
                createdAt: json.subscription.createdAt ?? json.subscription.updatedAt,
                updatedAt: json.subscription.updatedAt,
              } as UserSubscriptionInfo)
            : null;

        setIsPro(next);
        setIsPaidPro(nextPaid);
        setIsTrialActive(nextTrial);
        setTrialEndsAt(nextTrialEnd);
        setTrialDays(nextTrialDays);
        setSubscription(nextSubscription);

        localStorage.setItem('isPro', next ? 'true' : 'false');
        localStorage.setItem(LS_CACHED_UID, session.user.id);
        localStorage.setItem(LS_TRIAL_DAYS, String(nextTrialDays));
        localStorage.setItem(LS_PAID_PRO, nextPaid ? 'true' : 'false');
        localStorage.setItem(LS_TRIAL_ACTIVE, nextTrial ? 'true' : 'false');
        if (nextTrialEnd) {
          localStorage.setItem(LS_TRIAL_ENDS, nextTrialEnd);
        } else {
          localStorage.removeItem(LS_TRIAL_ENDS);
        }
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Silently fail and keep cached values - this handles network errors, CORS issues, timeouts, etc.
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.debug('Subscription fetch timeout');
          } else {
            console.debug('Subscription fetch error (using cache):', fetchError.message);
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Catch any unexpected errors
      console.debug('Subscription refresh error:', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [clearSubscriptionCache]);

  useEffect(() => {
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      clearSubscriptionCache();
      setLoading(false);
      return;
    }

    if (authLoading) return;

    if (!user?.uid) {
      clearSubscriptionCache();
      setLoading(false);
      return;
    }

    refresh().catch(() => setLoading(false));
  }, [user?.uid, authLoading, refresh, clearSubscriptionCache]);

  useEffect(() => {
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;

      if (event === 'SIGNED_OUT') {
        clearSubscriptionCache();
        setLoading(false);
        return;
      }

      if (
        session?.user &&
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED')
      ) {
        refresh().catch(() => setLoading(false));
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh, clearSubscriptionCache]);

  const value = useMemo(
    () => ({ isPro, isPaidPro, isTrialActive, trialEndsAt, trialDays, subscription, loading, refresh }),
    [isPro, isPaidPro, isTrialActive, trialEndsAt, trialDays, subscription, loading, refresh]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
