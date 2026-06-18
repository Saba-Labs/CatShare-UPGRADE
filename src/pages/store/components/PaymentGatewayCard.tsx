import { FiExternalLink, FiLink2, FiSettings, FiX } from 'react-icons/fi';
import type { IntegrationConnectionStatus } from '../../../integrations/core/types';
import {
  canConnect,
  canDisconnect,
  getIntegrationStatusBadge,
  isConnectedStatus,
} from '../../../integrations/core/IntegrationStatusService';
import type { PaymentGatewayDefinition } from '../config/paymentGateways';

interface PaymentGatewayCardProps {
  gateway: PaymentGatewayDefinition;
  status?: IntegrationConnectionStatus;
  displayStatus?: string;
  loading?: boolean;
  actionLoading?: boolean;
  onConnect?: () => void;
  onManage?: () => void;
  onDisconnect?: () => void;
}

function statusBadgeClasses(variant: string): string {
  switch (variant) {
    case 'success':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    case 'error':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

export default function PaymentGatewayCard({
  gateway,
  status = 'not_connected',
  displayStatus,
  loading = false,
  actionLoading = false,
  onConnect,
  onManage,
  onDisconnect,
}: PaymentGatewayCardProps) {
  const isComingSoon = !gateway.available;
  const connected = gateway.available && isConnectedStatus(status);
  const statusConfig = gateway.available
    ? getIntegrationStatusBadge(status)
  : { variant: 'neutral' as const, label: 'Coming Soon' };
  const statusLabel = displayStatus ?? statusConfig.label;
  const showConnect = gateway.available && canConnect(status);
  const showManage =
    gateway.available &&
    (connected || status === 'pending_verification' || status === 'error');
  const showDisconnect = gateway.available && canDisconnect(status) && status !== 'not_connected';

  if (loading) {
    return (
      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm animate-pulse">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800/80" />
            <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800/80" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group rounded-2xl border bg-white dark:bg-gray-900 p-5 shadow-sm transition-all ${
        isComingSoon
          ? 'border-gray-200 dark:border-gray-800 opacity-90'
          : 'border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-sm"
          style={{
            backgroundColor: gateway.logo.background,
            color: gateway.logo.color,
          }}
          aria-hidden
        >
          {gateway.logo.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {gateway.name}
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(statusConfig.variant)}`}
            >
              {isComingSoon ? 'Coming Soon' : statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {gateway.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {showConnect && (
          <button
            type="button"
            onClick={onConnect}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <FiLink2 className="h-4 w-4" />
            Connect
          </button>
        )}

        {showManage && (
          <button
            type="button"
            onClick={onManage}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <FiSettings className="h-4 w-4" />
            Manage
          </button>
        )}

        {showDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <FiX className="h-4 w-4" />
            {actionLoading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}

        {isComingSoon && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-400 dark:text-gray-500 cursor-not-allowed"
          >
            <FiExternalLink className="h-4 w-4" />
            Coming Soon
          </button>
        )}
      </div>
    </article>
  );
}
