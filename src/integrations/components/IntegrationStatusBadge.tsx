import type { IntegrationConnectionStatus } from '../core/types';
import {
  getIntegrationStatusBadge,
  type StatusBadgeVariant,
} from '../core/IntegrationStatusService';

export function IntegrationStatusBadge({
  status,
  label,
}: {
  status: IntegrationConnectionStatus | string;
  label?: string;
}) {
  const config = getIntegrationStatusBadge(status as IntegrationConnectionStatus);
  const displayLabel = label ?? config.label;
  return (
    <span className={`int-badge ${config.variant}`}>{displayLabel}</span>
  );
}

export function PaymentStatusBadge({
  status,
}: {
  status: string;
}) {
  const variants: Record<string, StatusBadgeVariant> = {
    paid: 'success',
    failed: 'error',
    pending: 'pending',
    refunded: 'warning',
    cancelled: 'error',
  };
  const variant = variants[status] ?? 'neutral';
  const labels: Record<string, string> = {
    paid: 'Paid',
    failed: 'Failed',
    pending: 'Pending',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`int-badge ${variant}`}>
      {labels[status] ?? status}
    </span>
  );
}
