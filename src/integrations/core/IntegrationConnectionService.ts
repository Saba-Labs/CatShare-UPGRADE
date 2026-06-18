import type { IntegrationProviderId, SellerIntegrationView, IntegrationConnectOptions } from './types';
import { getProvider, isIntegrationProviderId } from './registry';
import {
  fetchSellerIntegrations,
  mapRowToSellerIntegration,
  isMissingIntegrationsTable,
} from '../services/sellerIntegrationsService';
import { cacheIntegrationsList, readCachedIntegrationsList } from '../services/integrationsCache';

export async function listSellerIntegrationViews(
  sellerId: string
): Promise<{ data: SellerIntegrationView[]; error: unknown }> {
  const res = await fetchSellerIntegrations(sellerId);
  if (res.error) {
    if (isMissingIntegrationsTable(res.error)) {
      return { data: [], error: null };
    }
    const cached = readCachedIntegrationsList(sellerId);
    if (cached.length > 0) {
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
      return { data: views, error: null };
    }
    return { data: [], error: res.error };
  }

  const rows = res.data ?? [];
  cacheIntegrationsList(sellerId, rows);

  const views: SellerIntegrationView[] = [];
  for (const row of rows) {
    if (!isIntegrationProviderId(row.provider)) continue;
    try {
      const provider = getProvider(row.provider);
      views.push(provider.normalizeConnection(row));
    } catch {
      /* skip unknown or broken provider rows */
    }
  }

  return { data: views, error: null };
}

export async function getIntegrationView(
  sellerId: string,
  providerId: IntegrationProviderId
): Promise<{ data: SellerIntegrationView | null; error: unknown }> {
  const list = await listSellerIntegrationViews(sellerId);
  if (list.error && !list.data.length) {
    return { data: null, error: list.error };
  }
  const found = list.data.find((v) => v.provider === providerId) ?? null;
  if (found) return { data: found, error: null };

  const provider = getProvider(providerId);
  const notConnected = provider.normalizeConnection({
    id: '',
    sellerUserId: sellerId,
    provider: providerId,
    category: provider.category,
    status: 'not_connected',
    accountId: null,
    metadata: {},
    connectedAt: null,
    updatedAt: new Date().toISOString(),
  });
  return { data: notConnected, error: null };
}

export async function connectIntegration(
  sellerId: string,
  providerId: IntegrationProviderId,
  options?: IntegrationConnectOptions
): Promise<{ data: SellerIntegrationView | null; error: unknown }> {
  try {
    const provider = getProvider(providerId);
    const result = await provider.connect(sellerId, options);
    await listSellerIntegrationViews(sellerId);
    return { data: result.connection, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function disconnectIntegration(
  sellerId: string,
  providerId: IntegrationProviderId
): Promise<{ error: unknown }> {
  try {
    const provider = getProvider(providerId);
    await provider.disconnect(sellerId);
    await listSellerIntegrationViews(sellerId);
    return { error: null };
  } catch (e) {
    return { error: e };
  }
}

export async function refreshIntegrationStatus(
  sellerId: string,
  providerId: IntegrationProviderId
): Promise<{ data: SellerIntegrationView | null; error: unknown }> {
  try {
    const provider = getProvider(providerId);
    const view = await provider.refreshStatus(sellerId);
    const res = await fetchSellerIntegrations(sellerId);
    if (res.data) {
      cacheIntegrationsList(sellerId, res.data);
    }
    return { data: view, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export function countConnectedIntegrations(views: SellerIntegrationView[]): number {
  return views.filter((v) => v.status === 'connected').length;
}

export { mapRowToSellerIntegration };
