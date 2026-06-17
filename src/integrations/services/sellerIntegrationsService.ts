/**
 * CRUD for seller_integrations table.
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import { isBrowserOnline } from '../../utils/cloudWritePolicy';
import type {
  IntegrationCategory,
  IntegrationConnectionStatus,
  IntegrationProviderId,
  SellerIntegration,
} from '../core/types';
import { readCachedIntegrationsList, cacheIntegrationsList } from './integrationsCache';

export type SellerIntegrationRow = Record<string, unknown>;

export function mapRowToSellerIntegration(row: SellerIntegrationRow): SellerIntegration {
  return {
    id: String(row.id ?? ''),
    sellerUserId: String(row.seller_user_id ?? row.sellerUserId ?? ''),
    provider: String(row.provider ?? '') as IntegrationProviderId,
    category: String(row.category ?? '') as IntegrationCategory,
    status: String(row.status ?? 'not_connected') as IntegrationConnectionStatus,
    accountId: row.account_id != null ? String(row.account_id) : null,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    connectedAt:
      row.connected_at != null
        ? String(row.connected_at)
        : row.connectedAt != null
          ? String(row.connectedAt)
          : null,
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
    createdAt:
      row.created_at != null
        ? String(row.created_at)
        : row.createdAt != null
          ? String(row.createdAt)
          : undefined,
  };
}

export async function fetchSellerIntegrations(
  sellerUserId: string
): Promise<{ data: SellerIntegration[] | null; error: unknown }> {
  try {
    if (!sellerUserId?.trim()) {
      return { data: null, error: new Error('Seller user ID is required') };
    }

    if (!isBrowserOnline()) {
      return { data: readCachedIntegrationsList(sellerUserId), error: null };
    }

    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('seller_integrations')
      .select('*')
      .eq('seller_user_id', sellerUserId)
      .order('updated_at', { ascending: false });

    if (error) {
      const cached = readCachedIntegrationsList(sellerUserId);
      if (cached.length > 0) return { data: cached, error: null };
      return { data: null, error };
    }

    const rows = (data ?? []).map((r) => mapRowToSellerIntegration(r as SellerIntegrationRow));
    cacheIntegrationsList(sellerUserId, rows);
    return { data: rows, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function fetchSellerIntegrationByProvider(
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<{ data: SellerIntegration | null; error: unknown }> {
  const res = await fetchSellerIntegrations(sellerUserId);
  if (res.error && !res.data?.length) {
    return { data: null, error: res.error };
  }
  const found = res.data?.find((r) => r.provider === provider) ?? null;
  return { data: found, error: null };
}
