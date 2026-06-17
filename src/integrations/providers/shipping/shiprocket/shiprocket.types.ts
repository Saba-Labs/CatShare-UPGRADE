import type { ShiprocketConnectionStatus } from '../../../core/types';

export interface ShiprocketIntegrationMetadata {
  warehouseName?: string;
  pickupAddress?: string;
  pickupLocationId?: number;
  pickupLocationName?: string;
  apiUserEmailMasked?: string;
  connectionDate?: string;
  tokenExpiresAt?: string;
  lastError?: string;
  isDemo?: boolean;
}

export function isShiprocketStatus(
  status: string
): status is ShiprocketConnectionStatus {
  return (
    status === 'not_connected' ||
    status === 'connected' ||
    status === 'error'
  );
}
