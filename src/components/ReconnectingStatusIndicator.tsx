/**
 * Shown when the device is online but Supabase session is still restoring.
 * Edits are blocked; cached catalogue remains visible.
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isCloudSyncedAccount, isSessionReconnecting } from '../utils/cloudWritePolicy';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import './ReconnectingStatusIndicator.css';

const RECONNECTING_MESSAGE =
  'Reconnecting… You can view your data. Editing resumes when connection is stable.';

export const ReconnectingStatusIndicator: React.FC = () => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();

  if (!isOnline || !isCloudSyncedAccount(user) || !isSessionReconnecting(user)) {
    return null;
  }

  return (
    <div
      className="reconnecting-status-banner fixed top-0 left-0 right-0 z-[90] border-b border-amber-900/25 bg-amber-600 px-3 font-semibold text-amber-50 antialiased"
      role="status"
      aria-live="polite"
      aria-label={RECONNECTING_MESSAGE}
    >
      <span className="reconnecting-status-banner__dot" aria-hidden />
      <div className="reconnecting-status-banner__marquee">
        <div className="reconnecting-status-banner__track">
          <span>{RECONNECTING_MESSAGE}</span>
          <span aria-hidden="true">{RECONNECTING_MESSAGE}</span>
        </div>
      </div>
    </div>
  );
};

export default ReconnectingStatusIndicator;
