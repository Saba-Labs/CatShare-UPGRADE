/**
 * Sync Status Indicator Component
 * Displays the status of Supabase synchronization
 * Shows in the header/top corner with icons and tooltips
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface SyncStatusEvent {
  dataType: string;
  status: 'success' | 'error';
  error?: string;
  timestamp: number;
}

export const SyncStatusIndicator: React.FC = () => {
  const { user, supabaseDataLoading } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Don't show indicator if user is not authenticated
    if (!user) {
      setShowIndicator(false);
      return;
    }

    setShowIndicator(true);

    // Set status based on Supabase data loading
    if (supabaseDataLoading) {
      setSyncStatus('syncing');
    } else {
      setSyncStatus('synced');

      // Auto-hide after 3 seconds when sync completes
      const timeout = setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [user, supabaseDataLoading]);

  useEffect(() => {
    // Listen for sync events from background sync operations
    const handleSyncEvent = (event: any) => {
      const detail = event.detail as SyncStatusEvent;

      if (detail.status === 'error') {
        setSyncStatus('error');
        setLastError(detail.error || `Failed to sync ${detail.dataType}`);

        // Auto-hide error after 5 seconds
        const timeout = setTimeout(() => {
          setSyncStatus('synced');
          setLastError(null);
        }, 5000);

        return () => clearTimeout(timeout);
      } else {
        setSyncStatus('synced');
        setLastError(null);

        // Auto-hide success indicator after 3 seconds
        const timeout = setTimeout(() => {
          setSyncStatus('idle');
        }, 3000);

        return () => clearTimeout(timeout);
      }
    };

    window.addEventListener('supabase-sync-status', handleSyncEvent);
    return () => {
      window.removeEventListener('supabase-sync-status', handleSyncEvent);
    };
  }, []);

  if (!showIndicator || syncStatus === 'idle') return null;

  const statusConfig: Record<string, { icon: string; color: string; bgColor: string; label: string; animate?: boolean }> = {
    syncing: {
      icon: '⟳',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      label: 'Syncing...',
      animate: true,
    },
    synced: {
      icon: '✓',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      label: 'Synced',
    },
    error: {
      icon: '⚠',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      label: 'Sync failed',
    },
  };

  const config = statusConfig[syncStatus as 'syncing' | 'synced' | 'error'];

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-40
        px-3 py-2 rounded-lg
        ${config.bgColor}
        flex items-center gap-2
        transition-all duration-200
        text-xs font-medium
      `}
      title={lastError || config.label}
    >
      <span
        className={`
          ${config.color}
          ${config.animate ? 'animate-spin' : ''}
          inline-block
        `}
      >
        {config.icon}
      </span>
      <span className={config.color}>
        {lastError ? lastError.substring(0, 30) : config.label}
      </span>
    </div>
  );
};

export default SyncStatusIndicator;
