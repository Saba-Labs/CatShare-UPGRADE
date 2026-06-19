import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPersistedAuthUserId } from '../utils/authUserId';
import { getSellerStore, type Store } from '../services/storeService';
import { readCachedSellerStore } from '../utils/storePageCache';

export function useSellerStore() {
  const { user, loading: authLoading } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    const cached = readCachedSellerStore(sellerId);
    if (cached) {
      setStore(cached);
      setLoading(false);
      setError(null);
    }
  }, [sellerId]);

  const reload = useCallback(async () => {
    if (!sellerId) {
      setStore(null);
      setLoading(false);
      return;
    }

    const cached = readCachedSellerStore(sellerId);
    if (!cached) {
      setLoading(true);
    }

    const result = await getSellerStore(sellerId);
    if (result.success && result.data) {
      setStore(result.data);
      setError(null);
    } else if (cached) {
      setStore(cached);
      setError(null);
    } else {
      setStore(null);
      setError(result.error ?? 'Store not found');
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void reload();
  }, [authLoading, sellerId, reload]);

  return {
    sellerId,
    store,
    setStore,
    loading: loading || (authLoading && !sellerId),
    error,
    reload,
  };
}
