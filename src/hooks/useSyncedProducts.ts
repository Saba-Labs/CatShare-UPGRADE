/**
 * Custom hook for managing product state with automatic Supabase sync
 * Performs optimistic updates locally while syncing to Supabase in background
 */

import { useAuth } from '../context/AuthContext';
import { syncProducts, syncDeletedProducts, deleteProductFromSupabase } from '../services/supabaseSync';
import { useCallback } from 'react';

interface UseSyncedProductsResult {
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  syncProductsToSupabase: (products: any[]) => Promise<void>;
  syncDeletedProductsToSupabase: (deletedProducts: any[]) => Promise<void>;
  syncProductDelete: (productId: string) => Promise<void>;
  clearSyncError: () => void;
}

/**
 * Hook that provides sync functions for products
 * Returns functions that can be called after updating local state
 */
export function useSyncedProducts(): UseSyncedProductsResult {
  const { user } = useAuth();

  const syncProductsToSupabase = useCallback(
    async (products: any[]) => {
      if (!user || !user.uid) {
        console.warn('⚠️ Cannot sync products: user not authenticated');
        return;
      }

      try {
        // Fire and forget - don't wait for sync to complete
        syncProducts(user.uid, products)
          .then(result => {
            if (!result.success) {
              console.error('❌ Failed to sync products:', result.error);
              // Could dispatch error event here for UI notification
            }
          })
          .catch(err => {
            console.error('❌ Exception syncing products:', err);
          });
      } catch (err) {
        console.error('❌ Error initiating product sync:', err);
      }
    },
    [user]
  );

  const syncDeletedProductsToSupabase = useCallback(
    async (deletedProducts: any[]) => {
      if (!user || !user.uid) {
        console.warn('⚠️ Cannot sync deleted products: user not authenticated');
        return;
      }

      try {
        // Fire and forget
        syncDeletedProducts(user.uid, deletedProducts)
          .then(result => {
            if (!result.success) {
              console.error('❌ Failed to sync deleted products:', result.error);
            }
          })
          .catch(err => {
            console.error('❌ Exception syncing deleted products:', err);
          });
      } catch (err) {
        console.error('❌ Error initiating deleted products sync:', err);
      }
    },
    [user]
  );

  const syncProductDelete = useCallback(
    async (productId: string) => {
      if (!user || !user.uid) {
        console.warn('⚠️ Cannot sync delete: user not authenticated');
        return;
      }

      try {
        // Fire and forget
        deleteProductFromSupabase(user.uid, productId)
          .then(result => {
            if (!result.success) {
              console.error('❌ Failed to sync product delete:', result.error);
            }
          })
          .catch(err => {
            console.error('❌ Exception syncing product delete:', err);
          });
      } catch (err) {
        console.error('❌ Error initiating product delete sync:', err);
      }
    },
    [user]
  );

  const clearSyncError = useCallback(() => {
    // Placeholder for error clearing
  }, []);

  return {
    syncStatus: 'idle',
    syncError: null,
    syncProductsToSupabase,
    syncDeletedProductsToSupabase,
    syncProductDelete,
    clearSyncError,
  };
}
