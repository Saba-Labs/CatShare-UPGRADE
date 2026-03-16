import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebaseConfig';

type SubscriptionContextValue = {
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPro, setIsPro] = useState<boolean>(() => {
    const cached = localStorage.getItem('isPro');
    return cached === 'true';
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = async () => {
    const user = auth.currentUser;
    if (!user) {
      setIsPro(false);
      localStorage.setItem('isPro', 'false');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const baseUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';
      const resp = await fetch(`${baseUrl}/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Subscription fetch failed (${resp.status})`);
      const json = await resp.json();
      const next = !!json?.isPro;
      setIsPro(next);
      localStorage.setItem('isPro', next ? 'true' : 'false');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => {
      refresh().catch(() => {
        setLoading(false);
      });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ isPro, loading, refresh }), [isPro, loading]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}