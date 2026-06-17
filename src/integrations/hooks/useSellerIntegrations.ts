import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import {
  listSellerIntegrationViews,
  countConnectedIntegrations,
} from '../core/IntegrationConnectionService';
import type { SellerIntegrationView } from '../core/types';

export function useSellerIntegrations() {
  const { user } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [views, setViews] = useState<SellerIntegrationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sellerId) {
      setViews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listSellerIntegrationViews(sellerId);
    if (res.error && !res.data.length) {
      setError(
        res.error instanceof Error ? res.error.message : 'Could not load integrations'
      );
    }
    setViews(res.data);
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    sellerId,
    views,
    loading,
    error,
    connectedCount: countConnectedIntegrations(views),
    reload,
  };
}
