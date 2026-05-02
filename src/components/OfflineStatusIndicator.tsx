/**
 * Offline Status Indicator Component
 * Shows when the app is offline and displays sync queue status
 */

import React, { useState, useEffect } from 'react';
import { syncQueue } from '../services/syncQueue';

interface QueueStats {
  total: number;
  pending: number;
  syncing: number;
  succeeded: number;
  failed: number;
}

export const OfflineStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    syncing: 0,
    succeeded: 0,
    failed: 0,
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Listen for online/offline status changes
    const handleOnlineStatus = (event: any) => {
      setIsOnline(event.detail.isOnline);
    };

    // Listen for queue changes
    const handleQueueChange = (event: any) => {
      setQueueStats(event.detail.stats);
    };

    window.addEventListener('sync-online-status', handleOnlineStatus);
    window.addEventListener('sync-queue-change', handleQueueChange);

    // Update initial queue stats
    setQueueStats(syncQueue.getQueueStats());

    return () => {
      window.removeEventListener('sync-online-status', handleOnlineStatus);
      window.removeEventListener('sync-queue-change', handleQueueChange);
    };
  }, []);

  if (isOnline && queueStats.total === 0) {
    return null; // Don't show if online and no queue
  }

  return (
    <>
      {/* Offline Banner */}
      {!isOnline && (
        <div
          className="offline-status-banner fixed top-0 left-0 right-0 z-[80] flex h-10 items-center justify-center gap-2 border-b border-red-950/40 bg-red-900 px-3 text-center font-semibold text-red-50 antialiased"
          style={{
            fontSize: 14,
            lineHeight: 1.25,
            fontFamily:
              'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
          }}
          role="status"
          aria-live="polite"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-300/90 animate-pulse" aria-hidden />
          <span className="truncate" title="Syncs when connection returns">
            Offline · syncs when online
          </span>
        </div>
      )}

      {/* Sync Queue Status */}
      {queueStats.total > 0 && (
        <div
          className={`
            fixed bottom-20 right-4 z-40
            px-4 py-3 rounded-lg shadow-lg
            ${
              queueStats.failed > 0
                ? 'bg-orange-500'
                : queueStats.pending > 0
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            }
            text-white text-xs
            cursor-pointer transition-all duration-200
          `}
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="font-medium mb-1">
            {queueStats.failed > 0
              ? `⚠️ ${queueStats.failed} failed to sync`
              : queueStats.pending > 0
              ? `🔄 ${queueStats.pending} waiting to sync`
              : `✓ ${queueStats.succeeded} synced`}
          </div>

          {showDetails && (
            <div className="text-xs mt-2 border-t border-white/20 pt-2 space-y-1">
              <div>Pending: {queueStats.pending}</div>
              <div>Syncing: {queueStats.syncing}</div>
              <div>Succeeded: {queueStats.succeeded}</div>
              <div>Failed: {queueStats.failed}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  syncQueue.processQueue();
                }}
                className="mt-2 w-full bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs transition"
              >
                Retry Now
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default OfflineStatusIndicator;
