import { useCallback, useEffect, useState } from 'react';
import { getProvider } from '../core/registry';
import { getIntegrationView } from '../core/IntegrationConnectionService';
import type { IntegrationProviderId, SellerIntegrationView } from '../core/types';
import { useAuth } from '../../context/AuthContext';
import { getPersistedAuthUserId } from '../../utils/authUserId';

export function useIntegrationProvider(providerId: IntegrationProviderId) {
  const { user } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';
  const provider = getProvider(providerId);

  const [view, setView] = useState<SellerIntegrationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getIntegrationView(sellerId, providerId);
    if (res.error) {
      setError(
        res.error instanceof Error ? res.error.message : 'Could not load integration'
      );
    }
    setView(res.data);
    setLoading(false);
  }, [sellerId, providerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    sellerId,
    provider,
    view,
    loading,
    actionLoading,
    setActionLoading,
    error,
    reload,
    setView,
  };
}
