import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { readCachedIntegrationsList } from '../services/integrationsCache';
import { getProvider, isIntegrationProviderId } from '../core/registry';
import {
  listSellerIntegrationViews,
  countConnectedIntegrations,
} from '../core/IntegrationConnectionService';
import { formatIntegrationFetchError } from '../services/sellerIntegrationsService';
import type { SellerIntegrationView } from '../core/types';

function integrationViewsFromCache(sellerId: string): SellerIntegrationView[] {
  const cached = readCachedIntegrationsList(sellerId);
  const views: SellerIntegrationView[] = [];
  for (const row of cached) {
    if (!isIntegrationProviderId(row.provider)) continue;
    try {
      const provider = getProvider(row.provider);
      views.push(provider.normalizeConnection(row));
    } catch {
      /* skip */
    }
  }
  return views;
}

export function useSellerIntegrations() {
  const { user } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [views, setViews] = useState<SellerIntegrationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    const cachedViews = integrationViewsFromCache(sellerId);
    if (cachedViews.length > 0) {
      setViews(cachedViews);
      setLoading(false);
      setError(null);
    }
  }, [sellerId]);

  const reload = useCallback(async () => {
    if (!sellerId) {
      setViews([]);
      setLoading(false);
      return;
    }

    const cachedViews = integrationViewsFromCache(sellerId);
    if (cachedViews.length === 0) {
      setLoading(true);
    }
    setError(null);

    const res = await listSellerIntegrationViews(sellerId);
    if (res.error && !res.data.length) {
      if (cachedViews.length > 0) {
        setViews(cachedViews);
        setError(null);
      } else {
        setError(formatIntegrationFetchError(res.error));
      }
    } else {
      setError(null);
      setViews(res.data);
    }
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
