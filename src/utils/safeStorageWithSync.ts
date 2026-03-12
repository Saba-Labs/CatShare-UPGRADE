/**
 * Wrapper for safeStorage that automatically triggers Supabase sync
 * This enables background sync without modifying every setProducts call
 */

import { safeSetInStorage, safeGetFromStorage } from './safeStorage';
import { syncProducts, syncDeletedProducts, syncCataloguesDefinition, syncFieldsDefinition, syncUserSettings } from '../services/supabaseSync';

interface SyncStorageOptions {
  userId: string;
  syncInBackground?: boolean; // Default: true
}

/**
 * Set products in storage and sync to Supabase in background
 */
export async function safeSetProductsWithSync(
  products: any[],
  options: SyncStorageOptions
): Promise<boolean> {
  // Always save locally first
  const localSaveSuccess = safeSetInStorage('products', products);
  
  if (!localSaveSuccess) {
    return false;
  }

  // Trigger background sync if user is authenticated
  if (options.userId && options.syncInBackground !== false) {
    triggerProductSync(products, options.userId);
  }

  return true;
}

/**
 * Set deleted products in storage and sync to Supabase in background
 */
export async function safeSetDeletedProductsWithSync(
  deletedProducts: any[],
  options: SyncStorageOptions
): Promise<boolean> {
  const localSaveSuccess = safeSetInStorage('deletedProducts', deletedProducts);
  
  if (!localSaveSuccess) {
    return false;
  }

  if (options.userId && options.syncInBackground !== false) {
    triggerDeletedProductsSync(deletedProducts, options.userId);
  }

  return true;
}

/**
 * Set catalogues definition in storage and sync to Supabase
 */
export async function safeSetCataloguesWithSync(
  cataloguesDefinition: any,
  options: SyncStorageOptions
): Promise<boolean> {
  const localSaveSuccess = safeSetInStorage('cataloguesDefinition', cataloguesDefinition);
  
  if (!localSaveSuccess) {
    return false;
  }

  if (options.userId && options.syncInBackground !== false) {
    triggerCataloguesSync(cataloguesDefinition, options.userId);
  }

  return true;
}

/**
 * Set fields definition in storage and sync to Supabase
 */
export async function safeSetFieldsWithSync(
  fieldsDefinition: any,
  options: SyncStorageOptions
): Promise<boolean> {
  const localSaveSuccess = safeSetInStorage('fieldsDefinition', fieldsDefinition);
  
  if (!localSaveSuccess) {
    return false;
  }

  if (options.userId && options.syncInBackground !== false) {
    triggerFieldsSync(fieldsDefinition, options.userId);
  }

  return true;
}

/**
 * Set user settings in storage and sync to Supabase
 */
export async function safeSetUserSettingsWithSync(
  settings: any,
  options: SyncStorageOptions
): Promise<boolean> {
  const localSaveSuccess = safeSetInStorage('userSettings', settings);
  
  if (!localSaveSuccess) {
    return false;
  }

  if (options.userId && options.syncInBackground !== false) {
    triggerSettingsSync(settings, options.userId);
  }

  return true;
}

// Background sync triggers - these run asynchronously without blocking the UI

function triggerProductSync(products: any[], userId: string): void {
  // Use setTimeout to defer execution to next tick
  setTimeout(() => {
    syncProducts(userId, products)
      .then(result => {
        if (result.success) {
          console.log('✅ Products synced to Supabase');
          dispatchSyncEvent('products', 'success');
        } else {
          console.warn('⚠️ Products sync failed:', result.error);
          dispatchSyncEvent('products', 'error', result.error);
        }
      })
      .catch(err => {
        console.error('❌ Error syncing products:', err);
        dispatchSyncEvent('products', 'error', err.message);
      });
  }, 0);
}

function triggerDeletedProductsSync(deletedProducts: any[], userId: string): void {
  setTimeout(() => {
    syncDeletedProducts(userId, deletedProducts)
      .then(result => {
        if (result.success) {
          console.log('✅ Deleted products synced to Supabase');
          dispatchSyncEvent('deletedProducts', 'success');
        } else {
          console.warn('⚠️ Deleted products sync failed:', result.error);
          dispatchSyncEvent('deletedProducts', 'error', result.error);
        }
      })
      .catch(err => {
        console.error('❌ Error syncing deleted products:', err);
        dispatchSyncEvent('deletedProducts', 'error', err.message);
      });
  }, 0);
}

function triggerCataloguesSync(cataloguesDefinition: any, userId: string): void {
  setTimeout(() => {
    syncCataloguesDefinition(userId, cataloguesDefinition)
      .then(result => {
        if (result.success) {
          console.log('✅ Catalogues synced to Supabase');
          dispatchSyncEvent('catalogues', 'success');
        } else {
          console.warn('⚠️ Catalogues sync failed:', result.error);
          dispatchSyncEvent('catalogues', 'error', result.error);
        }
      })
      .catch(err => {
        console.error('❌ Error syncing catalogues:', err);
        dispatchSyncEvent('catalogues', 'error', err.message);
      });
  }, 0);
}

function triggerFieldsSync(fieldsDefinition: any, userId: string): void {
  setTimeout(() => {
    syncFieldsDefinition(userId, fieldsDefinition)
      .then(result => {
        if (result.success) {
          console.log('✅ Fields synced to Supabase');
          dispatchSyncEvent('fields', 'success');
        } else {
          console.warn('⚠️ Fields sync failed:', result.error);
          dispatchSyncEvent('fields', 'error', result.error);
        }
      })
      .catch(err => {
        console.error('❌ Error syncing fields:', err);
        dispatchSyncEvent('fields', 'error', err.message);
      });
  }, 0);
}

function triggerSettingsSync(settings: any, userId: string): void {
  setTimeout(() => {
    syncUserSettings(userId, settings)
      .then(result => {
        if (result.success) {
          console.log('✅ Settings synced to Supabase');
          dispatchSyncEvent('settings', 'success');
        } else {
          console.warn('⚠️ Settings sync failed:', result.error);
          dispatchSyncEvent('settings', 'error', result.error);
        }
      })
      .catch(err => {
        console.error('❌ Error syncing settings:', err);
        dispatchSyncEvent('settings', 'error', err.message);
      });
  }, 0);
}

/**
 * Dispatch custom event for sync status updates
 * Components can listen to these events to show sync status
 */
function dispatchSyncEvent(
  dataType: string,
  status: 'success' | 'error',
  error?: string
): void {
  const event = new CustomEvent('supabase-sync-status', {
    detail: {
      dataType,
      status,
      error,
      timestamp: Date.now(),
    },
  });
  window.dispatchEvent(event);
}

/**
 * Helper function to batch sync multiple data types
 * Useful when multiple things change at once
 */
export async function batchSyncToSupabase(
  userId: string,
  dataToSync: {
    products?: any[];
    deletedProducts?: any[];
    cataloguesDefinition?: any;
    fieldsDefinition?: any;
    userSettings?: any;
  }
): Promise<void> {
  const promises = [];

  if (dataToSync.products) {
    promises.push(syncProducts(userId, dataToSync.products));
  }
  if (dataToSync.deletedProducts) {
    promises.push(syncDeletedProducts(userId, dataToSync.deletedProducts));
  }
  if (dataToSync.cataloguesDefinition) {
    promises.push(syncCataloguesDefinition(userId, dataToSync.cataloguesDefinition));
  }
  if (dataToSync.fieldsDefinition) {
    promises.push(syncFieldsDefinition(userId, dataToSync.fieldsDefinition));
  }
  if (dataToSync.userSettings) {
    promises.push(syncUserSettings(userId, dataToSync.userSettings));
  }

  // Wait for all syncs in parallel
  const results = await Promise.all(promises);
  
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.warn(`⚠️ ${failed.length} sync operations failed`);
  } else {
    console.log('✅ All data synced to Supabase');
  }
}
