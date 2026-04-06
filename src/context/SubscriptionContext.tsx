import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, getSupabaseAccessToken } from '../supabaseClient';
import { TRIAL_DAYS_UI_FALLBACK } from '../config/freeTierLimits';

const LS_TRIAL_ENDS = 'subscription_trialEndsAt';
const LS_TRIAL_ACTIVE = 'subscription_isTrialActive';
const LS_PAID_PRO = 'subscription_isPaidPro';
const LS_TRIAL_DAYS = 'subscription_trialDays';

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
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

function readCachedTrialDays(): number {
  const raw = localStorage.getItem(LS_TRIAL_DAYS);
  if (raw == null || raw === '') return TRIAL_DAYS_UI_FALLBACK;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : TRIAL_DAYS_UI_FALLBACK;
}

function readCachedTrial(): Pick<
  SubscriptionContextValue,
  'trialEndsAt' | 'isTrialActive' | 'isPaidPro' | 'trialDays'
> {
  const trialEndsAt = localStorage.getItem(LS_TRIAL_ENDS);
  return {
    trialEndsAt: trialEndsAt && trialEndsAt.length > 0 ? trialEndsAt : null,
    isTrialActive: localStorage.getItem(LS_TRIAL_ACTIVE) === 'true',
    isPaidPro: localStorage.getItem(LS_PAID_PRO) === 'true',
    trialDays: readCachedTrialDays(),
  };
}

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPro, setIsPro] = useState<boolean>(() => {
    return localStorage.getItem('isPro') === 'true';
  });
  const [isPaidPro, setIsPaidPro] = useState<boolean>(() => readCachedTrial().isPaidPro);
  const [isTrialActive, setIsTrialActive] = useState<boolean>(() => readCachedTrial().isTrialActive);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(() => readCachedTrial().trialEndsAt);
  const [trialDays, setTrialDays] = useState<number>(() => readCachedTrial().trialDays);
  const [loading, setLoading] = useState<boolean>(true);

  const clearSubscriptionCache = useCallback(() => {
    setIsPro(false);
    setIsPaidPro(false);
    setIsTrialActive(false);
    setTrialEndsAt(null);
    setTrialDays(TRIAL_DAYS_UI_FALLBACK);
    localStorage.setItem('isPro', 'false');
    localStorage.removeItem(LS_TRIAL_ENDS);
    localStorage.setItem(LS_TRIAL_ACTIVE, 'false');
    localStorage.setItem(LS_PAID_PRO, 'false');
    localStorage.removeItem(LS_TRIAL_DAYS);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        clearSubscriptionCache();
        setLoading(false);
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
      const timeoutId = setTimeout(() => controller.abort(), 5000);

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
          console.debug('Subscription fetch failed:', fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
          return;
        }

        if (!resp.ok) {
          console.debug(`Subscription API returned status ${resp.status}`);
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

        setIsPro(next);
        setIsPaidPro(nextPaid);
        setIsTrialActive(nextTrial);
        setTrialEndsAt(nextTrialEnd);
        setTrialDays(nextTrialDays);

        localStorage.setItem('isPro', next ? 'true' : 'false');
        localStorage.setItem(LS_TRIAL_DAYS, String(nextTrialDays));
        localStorage.setItem(LS_PAID_PRO, nextPaid ? 'true' : 'false');
        localStorage.setItem(LS_TRIAL_ACTIVE, nextTrial ? 'true' : 'false');
        if (nextTrialEnd) {
          localStorage.setItem(LS_TRIAL_ENDS, nextTrialEnd);
        } else {
          localStorage.removeItem(LS_TRIAL_ENDS);
        }
      } catch (fetchError) {
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
    // Skip subscription check for offline guest users
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      clearSubscriptionCache();
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Token refresh does not change subscription; INITIAL_SESSION duplicates the mount refresh().
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      refresh().catch(() => setLoading(false));
    });
    refresh().catch(() => setLoading(false));
    return () => subscription.unsubscribe();
  }, [refresh, clearSubscriptionCache]);

  const value = useMemo(
    () => ({ isPro, isPaidPro, isTrialActive, trialEndsAt, trialDays, loading, refresh }),
    [isPro, isPaidPro, isTrialActive, trialEndsAt, trialDays, loading, refresh]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
