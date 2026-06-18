import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import {
  listSellerIntegrationViews,
  countConnectedIntegrations,
} from '../core/IntegrationConnectionService';
import { formatIntegrationFetchError } from '../services/sellerIntegrationsService';
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
      setError(formatIntegrationFetchError(res.error));
    } else {
      setError(null);
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
