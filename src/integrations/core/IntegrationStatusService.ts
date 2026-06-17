import type { IntegrationConnectionStatus } from './types';

export type StatusBadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'pending';

export interface StatusBadgeConfig {
  variant: StatusBadgeVariant;
  label: string;
}

const STATUS_BADGE_MAP: Record<IntegrationConnectionStatus, StatusBadgeConfig> = {
  not_connected: { variant: 'neutral', label: 'Not Connected' },
  pending_verification: { variant: 'pending', label: 'Pending Verification' },
  connected: { variant: 'success', label: 'Connected' },
  error: { variant: 'error', label: 'Error' },
};

export function getIntegrationStatusBadge(
  status: IntegrationConnectionStatus
): StatusBadgeConfig {
  return STATUS_BADGE_MAP[status] ?? { variant: 'neutral', label: 'Unknown' };
}

export function isConnectedStatus(status: IntegrationConnectionStatus): boolean {
  return status === 'connected';
}

export function canConnect(status: IntegrationConnectionStatus): boolean {
  return status === 'not_connected' || status === 'error';
}

export function canDisconnect(status: IntegrationConnectionStatus): boolean {
  return status === 'connected' || status === 'pending_verification' || status === 'error';
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  failed: 'Failed',
  pending: 'Pending',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

export function getPaymentStatusBadgeVariant(
  status: string
): StatusBadgeVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'pending':
      return 'pending';
    case 'refunded':
      return 'warning';
    default:
      return 'neutral';
  }
}
