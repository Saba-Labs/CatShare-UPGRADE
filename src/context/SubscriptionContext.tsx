import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { auth } from '../config/firebaseConfig';

type SubscriptionContextValue = {
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPro, setIsPro] = useState<boolean>(() => {
    return localStorage.getItem('isPro') === 'true';
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setIsPro(false);
      localStorage.setItem('isPro', 'false');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
      // Skip subscription check if backend URL is not configured
      if (!baseUrl) {
        setLoading(false);
        return;
      }
      const resp = await fetch(`${baseUrl}/api/subscription?userId=${user.uid}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!resp.ok) throw new Error(`Subscription fetch failed (${resp.status})`);
      const json = await resp.json();
      const next = !!json?.isPro;
      setIsPro(next);
      localStorage.setItem('isPro', next ? 'true' : 'false');
    } catch (error) {
      // Keep cached value if offline/error, log for debugging
      console.warn('⚠️ Failed to fetch subscription status:', error instanceof Error ? error.message : error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip subscription check for offline guest users
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      // Guests don't have subscriptions, just use free tier
      setIsPro(false);
      setLoading(false);
      return;
    }

    const unsub = auth.onAuthStateChanged(() => {
      refresh().catch(() => setLoading(false));
    });
    return () => unsub();
  }, [refresh]);

  const value = useMemo(() => ({ isPro, loading, refresh }), [isPro, loading, refresh]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
