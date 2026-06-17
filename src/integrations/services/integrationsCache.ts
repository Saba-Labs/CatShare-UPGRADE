import { getStorageKey, safeGetFromStorage, safeSetInStorage } from '../../utils/safeStorage';
import type { SellerIntegration } from '../core/types';
import { mapRowToSellerIntegration } from './sellerIntegrationsService';

export function cacheIntegrationsList(
  sellerUserId: string,
  rows: SellerIntegration[]
): void {
  safeSetInStorage(getStorageKey('integrations', sellerUserId), rows);
}

export function readCachedIntegrationsList(sellerUserId: string): SellerIntegration[] {
  const parsed = safeGetFromStorage<SellerIntegration[]>(
    getStorageKey('integrations', sellerUserId),
    []
  );
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) =>
    mapRowToSellerIntegration(row as unknown as Record<string, unknown>)
  );
}
