import {
  canConnect,
  canDisconnect,
  isConnectedStatus,
} from '../core/IntegrationStatusService';
import type { IntegrationConnectionStatus } from '../core/types';

export function IntegrationActionBar({
  status,
  connectLabel,
  loading,
  onConnect,
  onRefresh,
  onDisconnect,
  showDetails,
  onToggleDetails,
}: {
  status: IntegrationConnectionStatus;
  connectLabel: string;
  loading?: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  showDetails?: boolean;
  onToggleDetails?: () => void;
}) {
  const connected = isConnectedStatus(status);
  const pending = status === 'pending_verification';

  return (
    <div className="int-actions">
      {canConnect(status) ? (
        <button
          type="button"
          className="int-btn int-btn-primary"
          disabled={loading}
          onClick={onConnect}
        >
          {loading ? 'Connecting…' : connectLabel}
        </button>
      ) : null}

      {(connected || pending || status === 'error') && canDisconnect(status) ? (
        <>
          {onToggleDetails ? (
            <button
              type="button"
              className="int-btn int-btn-secondary"
              disabled={loading}
              onClick={onToggleDetails}
            >
              {showDetails ? 'Hide Details' : 'View Details'}
            </button>
          ) : null}
          <button
            type="button"
            className="int-btn int-btn-secondary"
            disabled={loading}
            onClick={onRefresh}
          >
            {loading ? 'Refreshing…' : 'Refresh Status'}
          </button>
          <button
            type="button"
            className="int-btn int-btn-danger"
            disabled={loading}
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </>
      ) : null}
    </div>
  );
}
