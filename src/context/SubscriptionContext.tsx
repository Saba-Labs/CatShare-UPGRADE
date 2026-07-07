import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase, getSupabaseAccessToken } from '../supabaseClient';
import { TRIAL_DAYS_UI_FALLBACK } from '../config/freeTierLimits';
import { useAuth } from './AuthContext';
import { getPersistedAuthUserId } from '../utils/authUserId';
import type { UserSubscriptionInfo } from '../utils/subscriptionDisplay';
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
  type CachedEntitlement,
} from '../utils/subscriptionCache';

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
  /** True while entitlement for the current user is still being resolved. */
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

const EMPTY_ENTITLEMENT: CachedEntitlement = {
  isPro: false,
  isPaidPro: false,
  isTrialActive: false,
  trialEndsAt: null,
  trialDays: TRIAL_DAYS_UI_FALLBACK,
  subscription: null,
};

function parseSubscriptionResponse(json: unknown): CachedEntitlement | null {
  if (!json || typeof json !== 'object') return null;
  const payload = json as Record<string, unknown>;
  const nextTrialDays =
    typeof payload.trialDays === 'number' && Number.isFinite(payload.trialDays) && payload.trialDays > 0
      ? payload.trialDays
      : TRIAL_DAYS_UI_FALLBACK;
  const nextTrialEnd =
    typeof payload.trialEndsAt === 'string' && payload.trialEndsAt.length > 0
      ? payload.trialEndsAt
      : null;
  const nextSubscription =
    payload.subscription && typeof payload.subscription === 'object'
      ? ({
          platform: (payload.subscription as UserSubscriptionInfo).platform,
          productId: (payload.subscription as UserSubscriptionInfo).productId,
          status: (payload.subscription as UserSubscriptionInfo).status,
          expiresAt: (payload.subscription as UserSubscriptionInfo).expiresAt ?? null,
          createdAt:
            (payload.subscription as UserSubscriptionInfo).createdAt ??
            (payload.subscription as UserSubscriptionInfo).updatedAt,
          updatedAt: (payload.subscription as UserSubscriptionInfo).updatedAt,
        } as UserSubscriptionInfo)
      : null;

  return {
    isPro: !!payload.isPro,
    isPaidPro: !!payload.isPaidPro,
    isTrialActive: !!payload.isTrialActive,
    trialEndsAt: nextTrialEnd,
    trialDays: nextTrialDays,
    subscription: nextSubscription,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const initialEntitlement = useMemo(
    () => readCachedEntitlement(getPersistedAuthUserId()) ?? EMPTY_ENTITLEMENT,
    []
  );
  const [isPro, setIsPro] = useState(initialEntitlement.isPro);
  const [isPaidPro, setIsPaidPro] = useState(initialEntitlement.isPaidPro);
  const [isTrialActive, setIsTrialActive] = useState(initialEntitlement.isTrialActive);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(initialEntitlement.trialEndsAt);
  const [trialDays, setTrialDays] = useState<number>(initialEntitlement.trialDays);
  const [subscription, setSubscription] = useState<UserSubscriptionInfo | null>(
    initialEntitlement.subscription
  );
  const [loading, setLoading] = useState(true);
  const activeUserIdRef = useRef<string | null>(getPersistedAuthUserId());

  const setEntitlementState = useCallback((entitlement: CachedEntitlement) => {
    setIsPro(entitlement.isPro);
    setIsPaidPro(entitlement.isPaidPro);
    setIsTrialActive(entitlement.isTrialActive);
    setTrialEndsAt(entitlement.trialEndsAt);
    setTrialDays(entitlement.trialDays);
    setSubscription(entitlement.subscription);
  }, []);

  const hydrateFromCache = useCallback(
    (userId: string | null | undefined): CachedEntitlement | null => {
      const cached = readCachedEntitlement(userId);
      if (!cached) return null;
      setEntitlementState(cached);
      return cached;
    },
    [setEntitlementState]
  );

  const clearSubscriptionCache = useCallback(() => {
    setEntitlementState(EMPTY_ENTITLEMENT);
    clearCachedEntitlement();
  }, [setEntitlementState]);

  const refresh = useCallback(async () => {
    const userId = activeUserIdRef.current;
    if (!userId) return;

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        hydrateFromCache(userId);
        return;
      }

      const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
      if (!baseUrl) {
        hydrateFromCache(userId);
        return;
      }

      let accessToken: string | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          accessToken = await getSupabaseAccessToken();
        } catch (err) {
          console.debug(
            'Failed to get access token:',
            err instanceof Error ? err.message : String(err)
          );
        }
        if (accessToken) break;
        await sleep(250 * (attempt + 1));
      }

      if (!accessToken) {
        hydrateFromCache(userId);
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort('timeout'), 8000);

      try {
        const resp = await fetch(`${baseUrl}/api/subscription`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });

        if (!resp.ok) {
          console.debug(`Subscription API returned status ${resp.status}`);
          hydrateFromCache(userId);
          return;
        }

        const json = await resp.json();
        const parsed = parseSubscriptionResponse(json);
        if (!parsed) {
          hydrateFromCache(userId);
          return;
        }

        setEntitlementState(parsed);
        writeCachedEntitlement(session.user.id, parsed);
      } catch (fetchError) {
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.debug('Subscription fetch timeout');
          } else {
            console.debug('Subscription fetch error (using cache):', fetchError.message);
          }
        }
        hydrateFromCache(userId);
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (error) {
      console.debug(
        'Subscription refresh error:',
        error instanceof Error ? error.message : String(error)
      );
      hydrateFromCache(userId);
    } finally {
      setLoading(false);
    }
  }, [hydrateFromCache, setEntitlementState]);

  useEffect(() => {
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      activeUserIdRef.current = null;
      clearSubscriptionCache();
      setLoading(false);
      return;
    }

    if (authLoading) return;

    if (!user?.uid) {
      activeUserIdRef.current = null;
      clearSubscriptionCache();
      setLoading(false);
      return;
    }

    activeUserIdRef.current = user.uid;
    hydrateFromCache(user.uid);
    refresh().catch(() => setLoading(false));
  }, [user?.uid, authLoading, refresh, clearSubscriptionCache, hydrateFromCache]);

  useEffect(() => {
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) return;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;

      if (event === 'SIGNED_OUT') {
        activeUserIdRef.current = null;
        clearSubscriptionCache();
        setLoading(false);
        return;
      }

      if (
        session?.user &&
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED')
      ) {
        activeUserIdRef.current = session.user.id;
        hydrateFromCache(session.user.id);
        refresh().catch(() => setLoading(false));
      }
    });

    return () => authSubscription.unsubscribe();
  }, [refresh, clearSubscriptionCache, hydrateFromCache]);

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
