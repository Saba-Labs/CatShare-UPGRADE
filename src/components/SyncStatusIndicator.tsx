/**
 * Sync toast bridge:
 * Routes sync lifecycle events into the shared ToastContainer UI.
 * (No dedicated sync badge/card rendered.)
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface SyncStatusEvent {
  dataType: string;
  status: 'success' | 'error';
  error?: string;
  timestamp: number;
}

export const SyncStatusIndicator: React.FC = () => {
  const { user, supabaseDataLoading } = useAuth();
  const { showToast, updateToast, removeToast } = useToast();
  const wasLoadingRef = useRef(false);
  const syncToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (syncToastIdRef.current) {
        removeToast(syncToastIdRef.current);
        syncToastIdRef.current = null;
      }
      wasLoadingRef.current = false;
      return;
    }

    if (supabaseDataLoading && !wasLoadingRef.current) {
      if (syncToastIdRef.current) {
        updateToast(syncToastIdRef.current, 'Syncing...', 'info', 0);
      } else {
        syncToastIdRef.current = showToast('Syncing...', 'info', 0);
      }
    }
    if (!supabaseDataLoading && wasLoadingRef.current) {
      if (syncToastIdRef.current) {
        updateToast(syncToastIdRef.current, 'Synced', 'success', 1200);
        syncToastIdRef.current = null;
      } else {
        showToast('Synced', 'success', 1200);
      }
    }
    wasLoadingRef.current = supabaseDataLoading;
  }, [user, supabaseDataLoading, showToast, updateToast, removeToast]);

  useEffect(() => {
    const handleSyncEvent = (event: any) => {
      const detail = event.detail as SyncStatusEvent;
      if (detail.status === 'error') {
        const message = detail.error || `Failed to sync ${detail.dataType}`;
        if (syncToastIdRef.current) {
          updateToast(syncToastIdRef.current, message, 'error', 4000);
          syncToastIdRef.current = null;
        } else {
          showToast(message, 'error', 4000);
        }
      }
    };

    window.addEventListener('supabase-sync-status', handleSyncEvent);
    return () => {
      window.removeEventListener('supabase-sync-status', handleSyncEvent);
    };
  }, [showToast, updateToast]);

  return null;
};

export default SyncStatusIndicator;
