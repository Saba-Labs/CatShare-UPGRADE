/**
 * Backup/Restore Sync Service
 * Handles synchronization of backup/restore operations with Supabase
 * Allows users to upload restored data to Supabase or sync backup data
 */

import {
  syncProducts,
  syncDeletedProducts,
  syncCataloguesDefinition,
  syncFieldsDefinition,
  syncUserSettings,
  fetchAllUserData,
} from './supabaseSync';

interface RestoreData {
  products: any[];
  deletedProducts: any[];
  cataloguesDefinition?: any;
  fieldsDefinition?: any;
  userSettings?: any;
}

/**
 * Sync restored backup data to Supabase
 * Used after user restores a backup file
 */
export async function syncRestoreToSupabase(
  userId: string,
  restoredData: RestoreData
): Promise<{
  success: boolean;
  results: {
    products: boolean;
    deletedProducts: boolean;
    cataloguesDefinition: boolean;
    fieldsDefinition: boolean;
    userSettings: boolean;
  };
  error?: string;
}> {
  try {
    if (!userId) {
      return {
        success: false,
        results: {
          products: false,
          deletedProducts: false,
          cataloguesDefinition: false,
          fieldsDefinition: false,
          userSettings: false,
        },
        error: 'User ID is required',
      };
    }

    console.log('🔄 Starting sync of restored data to Supabase...');

    // Perform all syncs in parallel for better performance
    const [
      productsResult,
      deletedResult,
      cataloguesResult,
      fieldsResult,
      settingsResult,
    ] = await Promise.all([
      syncProducts(userId, restoredData.products || [], { skipImageUrlAssertion: true }),
      syncDeletedProducts(userId, restoredData.deletedProducts || [], {
        skipImageUrlAssertion: true,
      }),
      restoredData.cataloguesDefinition
        ? syncCataloguesDefinition(userId, restoredData.cataloguesDefinition)
        : Promise.resolve({ success: true }),
      restoredData.fieldsDefinition
        ? syncFieldsDefinition(userId, restoredData.fieldsDefinition)
        : Promise.resolve({ success: true }),
      restoredData.userSettings
        ? syncUserSettings(userId, restoredData.userSettings)
        : Promise.resolve({ success: true }),
    ]);

    const results = {
      products: productsResult.success,
      deletedProducts: deletedResult.success,
      cataloguesDefinition: cataloguesResult.success,
      fieldsDefinition: fieldsResult.success,
      userSettings: settingsResult.success,
    };

    const allSuccess = Object.values(results).every(r => r);

    if (allSuccess) {
      console.log('✅ All restored data synced to Supabase successfully');
      return { success: true, results };
    } else {
      const failedSyncs = Object.entries(results)
        .filter(([_, success]) => !success)
        .map(([key, _]) => key);

      console.warn('⚠️ Some data failed to sync:', failedSyncs);
      return {
        success: false,
        results,
        error: `Failed to sync: ${failedSyncs.join(', ')}`,
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Error syncing restored data to Supabase:', errorMessage);
    return {
      success: false,
      results: {
        products: false,
        deletedProducts: false,
        cataloguesDefinition: false,
        fieldsDefinition: false,
        userSettings: false,
      },
      error: errorMessage,
    };
  }
}

/**
 * Merge restored data with existing Supabase data
 * Used to handle conflicts when restoring over existing data
 * Strategy: User's choice of which version to keep
 */
export async function mergeRestoreWithSupabase(
  userId: string,
  restoredData: RestoreData,
  mergeStrategy: 'keep-restored' | 'keep-existing' | 'merge'
): Promise<{
  success: boolean;
  mergedData: RestoreData;
  error?: string;
}> {
  try {
    if (!userId) {
      return {
        success: false,
        mergedData: restoredData,
        error: 'User ID is required',
      };
    }

    console.log(`🔄 Merging restored data with Supabase using '${mergeStrategy}' strategy...`);

    // Fetch existing data from Supabase
    const existingResult = await fetchAllUserData(userId);

    if (!existingResult.success || !existingResult.data) {
      // No existing data, just return restored data
      console.log('ℹ️ No existing data in Supabase, using restored data as-is');
      return {
        success: true,
        mergedData: restoredData,
      };
    }

    const existingData = existingResult.data;

    if (mergeStrategy === 'keep-restored') {
      // Replace all data with restored version
      console.log('→ Strategy: Keep restored data (overwrite Supabase)');
      return {
        success: true,
        mergedData: restoredData,
      };
    }

    if (mergeStrategy === 'keep-existing') {
      // Keep existing Supabase data, discard restored data
      console.log('→ Strategy: Keep existing Supabase data');
      return {
        success: true,
        mergedData: existingData as RestoreData,
      };
    }

    // mergeStrategy === 'merge' - Smart merge
    console.log('→ Strategy: Smart merge (newer versions win)');

    const mergedData: RestoreData = {
      products: mergeProductArrays(
        restoredData.products || [],
        existingData.products || []
      ),
      deletedProducts: mergeProductArrays(
        restoredData.deletedProducts || [],
        existingData.deletedProducts || []
      ),
      cataloguesDefinition:
        restoredData.cataloguesDefinition || existingData.cataloguesDefinition,
      fieldsDefinition:
        restoredData.fieldsDefinition || existingData.fieldsDefinition,
      userSettings: {
        ...existingData.userSettings,
        ...restoredData.userSettings,
      },
    };

    console.log('✅ Data merged successfully');
    return {
      success: true,
      mergedData,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Error merging data:', errorMessage);
    return {
      success: false,
      mergedData: restoredData,
      error: errorMessage,
    };
  }
}

/**
 * Helper: Merge two product arrays, keeping newer versions
 */
function mergeProductArrays(restored: any[], existing: any[]): any[] {
  const merged = new Map();

  // Add all existing products first
  existing.forEach(product => {
    merged.set(product.id, product);
  });

  // Merge restored products (newer timestamp wins)
  restored.forEach(restoredProduct => {
    const existingProduct = merged.get(restoredProduct.id);

    if (!existingProduct) {
      // New product from restore
      merged.set(restoredProduct.id, restoredProduct);
    } else {
      // Both exist, keep newer version
      const existingTime = new Date(existingProduct.updatedAt || 0).getTime();
      const restoredTime = new Date(restoredProduct.updatedAt || 0).getTime();

      if (restoredTime >= existingTime) {
        merged.set(restoredProduct.id, restoredProduct);
      }
      // else keep existing product
    }
  });

  return Array.from(merged.values());
}

/**
 * Show merge conflict dialog to user
 * Returns user's choice of merge strategy
 */
export function showMergeConflictDialog(): Promise<'keep-restored' | 'keep-existing' | 'merge'> {
  return new Promise(resolve => {
    // Dispatch event that SideDrawer or modal can listen to
    window.dispatchEvent(
      new CustomEvent('show-merge-conflict-dialog', {
        detail: {
          onChoice: (choice: 'keep-restored' | 'keep-existing' | 'merge') => {
            resolve(choice);
          },
        },
      })
    );
  });
}

/**
 * Get backup summary for display to user
 */
export function getBackupSummary(backupData: any): {
  productCount: number;
  deletedProductCount: number;
  hasMetadata: boolean;
  templateName?: string;
  backupDate?: string;
  appVersion?: string;
} {
  return {
    productCount: backupData.products?.length || 0,
    deletedProductCount: backupData.deletedProducts?.length || 0,
    hasMetadata: !!backupData.metadata,
    templateName: backupData.metadata?.template,
    backupDate: backupData.backupDate,
    appVersion: backupData.appVersion,
  };
}
