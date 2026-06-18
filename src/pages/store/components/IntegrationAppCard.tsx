import { FiExternalLink, FiLink2, FiSettings, FiX } from 'react-icons/fi';
import type { IntegrationConnectionStatus } from '../../../integrations/core/types';
import {
  canConnect,
  canDisconnect,
  getIntegrationStatusBadge,
} from '../../../integrations/core/IntegrationStatusService';
import type { StoreIntegrationDefinition } from '../config/storeIntegrations';

interface IntegrationAppCardProps {
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
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    case 'error':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

export default function IntegrationAppCard({
  integration,
  status = 'not_connected',
  displayStatus,
  loading = false,
  actionLoading = false,
  onConnect,
  onManage,
  onDisconnect,
}: IntegrationAppCardProps) {
  const isComingSoon = !integration.available && !integration.platformManaged;
  const isPlatform = integration.platformManaged === true;

  const statusConfig = isPlatform
    ? { variant: 'success' as const, label: 'Included' }
    : isComingSoon
      ? { variant: 'neutral' as const, label: 'Coming Soon' }
      : getIntegrationStatusBadge(status);

  const statusLabel = isPlatform
    ? 'Included with CatShare'
    : displayStatus ?? statusConfig.label;

  const showConnect =
    integration.available && !isPlatform && canConnect(status) && Boolean(onConnect);
  const showManage =
    (integration.available && !isComingSoon && Boolean(onManage)) ||
    (isPlatform && Boolean(onManage));
  const showDisconnect =
    integration.available &&
    !isPlatform &&
    canDisconnect(status) &&
    status !== 'not_connected' &&
    Boolean(onDisconnect);

  if (loading) {
    return (
      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm animate-pulse min-h-[200px]">
        <div className="flex gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800/80" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group flex flex-col rounded-2xl border bg-white dark:bg-gray-900 p-5 shadow-sm transition-all min-h-[200px] ${
        isComingSoon
          ? 'border-gray-200 dark:border-gray-800'
          : 'border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5'
      }`}
    >
      <div className="flex items-start gap-4 flex-1">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-sm ring-1 ring-black/5"
          style={{
            backgroundColor: integration.logo.background,
            color: integration.logo.color,
          }}
          aria-hidden
        >
          {integration.logo.initials || ''}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {integration.name}
            </h3>
            <span className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              v{integration.version}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(statusConfig.variant)}`}
            >
              {isComingSoon ? 'Coming Soon' : statusLabel}
            </span>
          </div>

          <p className="mt-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-3">
            {integration.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
        {showConnect && (
          <button
            type="button"
            onClick={onConnect}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <FiLink2 className="h-4 w-4" />
            Connect
          </button>
        )}

        {showManage && (
          <button
            type="button"
            onClick={onManage}
            disabled={actionLoading || isComingSoon}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
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
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-900 px-3.5 py-2 text-sm font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <FiX className="h-4 w-4" />
            {actionLoading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}

        {isComingSoon && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3.5 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
          >
            <FiExternalLink className="h-4 w-4" />
            Coming Soon
          </button>
        )}
      </div>
    </article>
  );
}
