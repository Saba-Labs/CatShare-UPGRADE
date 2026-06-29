import {
  canConnect,
  canDisconnect,
  getIntegrationStatusBadge,
  isConnectedStatus,
} from '../../../integrations/core/IntegrationStatusService';
import type { IntegrationConnectionStatus } from '../../../integrations/core/types';
import type { StoreIntegrationDefinition } from '../config/storeIntegrations';

interface IntegrationAppRowProps {
  integration: StoreIntegrationDefinition;
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
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'pending':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'error':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

export default function IntegrationAppRow({
  integration,
  status = 'not_connected',
  displayStatus,
  loading = false,
  actionLoading = false,
  onConnect,
  onManage,
  onDisconnect,
}: IntegrationAppRowProps) {
  const statusConfig = getIntegrationStatusBadge(status);
  const statusLabel = displayStatus ?? statusConfig.label;
  const connected = isConnectedStatus(status);

  const showConnect = canConnect(status) && Boolean(onConnect);
  const showManage = connected && Boolean(onManage);
  const showDisconnect =
    canDisconnect(status) && status !== 'not_connected' && Boolean(onDisconnect);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/30 p-4 animate-pulse">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40">
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
          style={{
            backgroundColor: integration.logo.background,
            color: integration.logo.color,
          }}
          aria-hidden
        >
          {integration.logo.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {integration.name}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClasses(statusConfig.variant)}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {integration.description}
          </p>
        </div>
      </div>

      {showConnect || showManage || showDisconnect ? (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
          {showConnect ? (
            <button
              type="button"
              onClick={onConnect}
              disabled={actionLoading}
              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Connect
            </button>
          ) : null}
          {showManage ? (
            <button
              type="button"
              onClick={onManage}
              disabled={actionLoading}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Manage
            </button>
          ) : null}
          {showDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={actionLoading}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {actionLoading ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
