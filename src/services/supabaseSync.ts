/**
 * Supabase Sync Service
 * Handles all data synchronization between local state and Supabase
 */

import { getSupabaseClient } from '../supabaseClient';

interface SyncOptions {
  userId: string;
  retryCount?: number;
  maxRetries?: number;
}

interface SyncResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Sync products to Supabase
 * Performs upsert operation (insert or update)
 */
export async function syncProducts(
  userId: string,
  products: any[]
): Promise<SyncResult> {
  try {
    if (!userId || !Array.isArray(products)) {
      return { success: false, error: 'Invalid input: userId or products array missing' };
    }

    // Strip image data before syncing to Supabase
    const cleanedProducts = products.map(p => {
      const clean = { ...p };
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
      return clean;
    });

    // Prepare data for upsert - batch operations
    const upsertData = cleanedProducts.map(product => ({
      user_id: userId,
      product_id: product.id,
      name: product.name || '',
      sku: product.sku || null,
      category_id: product.categoryId || null,
      data: product, // Store full product object in JSONB
      updated_at: new Date().toISOString(),
    }));

    if (upsertData.length === 0) {
      return { success: true, data: [] };
    }

    // Use upsert with on_conflict to handle duplicates
    const { data, error } = await supabase
      .from('products')
      .upsert(upsertData, {
        onConflict: 'user_id,product_id'
      })
      .select();

    if (error) {
      console.error('❌ Error syncing products to Supabase:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Synced ${cleanedProducts.length} products to Supabase`);
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync deleted products to Supabase
 */
export async function syncDeletedProducts(
  userId: string,
  deletedProducts: any[]
): Promise<SyncResult> {
  try {
    if (!userId || !Array.isArray(deletedProducts)) {
      return { success: false, error: 'Invalid input: userId or deletedProducts array missing' };
    }

    const upsertData = deletedProducts.map(product => ({
      user_id: userId,
      product_id: product.id,
      deleted_at: new Date().toISOString(),
    }));

    if (upsertData.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('deleted_products')
      .upsert(upsertData, {
        onConflict: 'user_id,product_id'
      })
      .select();

    if (error) {
      console.error('❌ Error syncing deleted products:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Synced ${deletedProducts.length} deleted products to Supabase`);
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncDeletedProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync categories to Supabase
 */
export async function syncCategories(
  userId: string,
  categories: any[]
): Promise<SyncResult> {
  try {
    if (!userId || !Array.isArray(categories)) {
      return { success: false, error: 'Invalid input: userId or categories array missing' };
    }

    const upsertData = categories.map(category => ({
      user_id: userId,
      category_id: category.id,
      name: category.name || '',
      data: category,
      updated_at: new Date().toISOString(),
    }));

    if (upsertData.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('categories')
      .upsert(upsertData, {
        onConflict: 'user_id,category_id'
      })
      .select();

    if (error) {
      console.error('❌ Error syncing categories:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Synced ${categories.length} categories to Supabase`);
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncCategories:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync catalogues definition to Supabase
 */
export async function syncCataloguesDefinition(
  userId: string,
  cataloguesDefinition: any
): Promise<SyncResult> {
  try {
    if (!userId || !cataloguesDefinition) {
      return { success: false, error: 'Invalid input: userId or cataloguesDefinition missing' };
    }

    // Delete old entries and insert new one (since this is a single document)
    const { error: deleteError } = await supabase
      .from('catalogues_definition')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error deleting old catalogue definition:', deleteError);
      return { success: false, error: deleteError.message };
    }

    const { data, error } = await supabase
      .from('catalogues_definition')
      .insert({
        user_id: userId,
        data: cataloguesDefinition,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('❌ Error syncing catalogues definition:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Synced catalogues definition to Supabase');
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncCataloguesDefinition:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync fields definition to Supabase
 */
export async function syncFieldsDefinition(
  userId: string,
  fieldsDefinition: any
): Promise<SyncResult> {
  try {
    if (!userId || !fieldsDefinition) {
      return { success: false, error: 'Invalid input: userId or fieldsDefinition missing' };
    }

    // Delete old entries and insert new one (since this is a single document)
    const { error: deleteError } = await supabase
      .from('fields_definition')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error deleting old fields definition:', deleteError);
      return { success: false, error: deleteError.message };
    }

    const { data, error } = await supabase
      .from('fields_definition')
      .insert({
        user_id: userId,
        data: fieldsDefinition,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('❌ Error syncing fields definition:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Synced fields definition to Supabase');
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncFieldsDefinition:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync user settings to Supabase
 */
export async function syncUserSettings(
  userId: string,
  settings: any
): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid input: userId missing' };
    }

    // Check if settings exist for this user
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabase
        .from('user_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ Error updating user settings:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Updated user settings in Supabase');
      return { success: true, data };
    } else {
      // Insert new settings
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error('❌ Error creating user settings:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Created user settings in Supabase');
      return { success: true, data };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncUserSettings:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch all user data from Supabase
 * Used for initial load or sync
 */
export async function fetchAllUserData(userId: string): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid input: userId missing' };
    }

    // Fetch all tables in parallel for better performance
    const [
      { data: products, error: productsError },
      { data: deletedProducts, error: deletedError },
      { data: categories, error: categoriesError },
      { data: cataloguesDef, error: cataloguesError },
      { data: fieldsDef, error: fieldsError },
      { data: settings, error: settingsError },
    ] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', userId),
      supabase.from('deleted_products').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('catalogues_definition').select('*').eq('user_id', userId),
      supabase.from('fields_definition').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).single(),
    ]);

    // Check for errors
    if (productsError && productsError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error fetching products:', JSON.stringify(productsError, null, 2));
      return { success: false, error: productsError.message };
    }

    if (deletedError && deletedError.code !== 'PGRST116') {
      console.error('❌ Error fetching deleted products:', JSON.stringify(deletedError, null, 2));
    }

    if (categoriesError && categoriesError.code !== 'PGRST116') {
      console.error('❌ Error fetching categories:', JSON.stringify(categoriesError, null, 2));
    }

    if (cataloguesError && cataloguesError.code !== 'PGRST116') {
      console.error('❌ Error fetching catalogues definition:', JSON.stringify(cataloguesError, null, 2));
    }

    if (fieldsError && fieldsError.code !== 'PGRST116') {
      console.error('❌ Error fetching fields definition:', JSON.stringify(fieldsError, null, 2));
    }

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('❌ Error fetching user settings:', JSON.stringify(settingsError, null, 2));
    }

    const userData = {
      products: products?.map(p => p.data) || [],
      deletedProducts: deletedProducts?.map(p => ({ ...p.data, id: p.product_id })) || [],
      categories: categories?.map(c => c.data) || [],
      cataloguesDefinition: cataloguesDef?.[0]?.data || null,
      fieldsDefinition: fieldsDef?.[0]?.data || null,
      userSettings: settings?.data || null,
    };

    console.log('✅ Fetched all user data from Supabase');
    return { success: true, data: userData };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in fetchAllUserData:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Set up realtime subscriptions for user data
 * Callback will be fired when data changes
 */
export function setupRealtimeSubscriptions(
  userId: string,
  callbacks: {
    onProductsChange?: (products: any[]) => void;
    onCategoriesChange?: (categories: any[]) => void;
    onSettingsChange?: (settings: any) => void;
  }
) {
  try {
    if (!userId) {
      console.error('❌ Cannot setup realtime subscriptions without userId');
      return () => {};
    }

    const unsubscribeFunctions: Array<() => void> = [];

    // Subscribe to products changes
    if (callbacks.onProductsChange) {
      const subscription = supabase
        .from('products')
        .on('*', (payload) => {
          if (payload.new.user_id === userId) {
            console.log('🔄 Products changed via realtime:', payload);
            // Fetch fresh products data
            supabase
              .from('products')
              .select('*')
              .eq('user_id', userId)
              .then(({ data }) => {
                if (data) {
                  callbacks.onProductsChange?.(data.map(p => p.data));
                }
              });
          }
        })
        .subscribe();

      unsubscribeFunctions.push(() => {
        supabase.removeSubscription(subscription);
      });
    }

    // Subscribe to categories changes
    if (callbacks.onCategoriesChange) {
      const subscription = supabase
        .from('categories')
        .on('*', (payload) => {
          if (payload.new?.user_id === userId) {
            console.log('🔄 Categories changed via realtime:', payload);
            supabase
              .from('categories')
              .select('*')
              .eq('user_id', userId)
              .then(({ data }) => {
                if (data) {
                  callbacks.onCategoriesChange?.(data.map(c => c.data));
                }
              });
          }
        })
        .subscribe();

      unsubscribeFunctions.push(() => {
        supabase.removeSubscription(subscription);
      });
    }

    // Subscribe to settings changes
    if (callbacks.onSettingsChange) {
      const subscription = supabase
        .from('user_settings')
        .on('*', (payload) => {
          if (payload.new?.user_id === userId) {
            console.log('🔄 Settings changed via realtime:', payload);
            callbacks.onSettingsChange?.(payload.new.data);
          }
        })
        .subscribe();

      unsubscribeFunctions.push(() => {
        supabase.removeSubscription(subscription);
      });
    }

    console.log('✅ Realtime subscriptions setup for user:', userId);

    // Return unsubscribe function that removes all subscriptions
    return () => {
      unsubscribeFunctions.forEach(fn => fn());
      console.log('✅ Realtime subscriptions removed');
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in setupRealtimeSubscriptions:', errorMessage);
    return () => {};
  }
}

/**
 * Perform a soft delete of a product in Supabase
 */
export async function deleteProductFromSupabase(
  userId: string,
  productId: string
): Promise<SyncResult> {
  try {
    if (!userId || !productId) {
      return { success: false, error: 'Invalid input: userId or productId missing' };
    }

    // Mark product as deleted in products table
    const { error: updateError } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (updateError) {
      console.error('❌ Error marking product as deleted:', updateError);
      return { success: false, error: updateError.message };
    }

    // Add to deleted_products table
    const { error: insertError } = await supabase
      .from('deleted_products')
      .upsert({
        user_id: userId,
        product_id: productId,
        deleted_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,product_id'
      });

    if (insertError) {
      console.error('❌ Error adding to deleted_products:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log(`✅ Soft deleted product ${productId} from Supabase`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in deleteProductFromSupabase:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if sync is needed by comparing local and remote data
 * Returns true if any local data is newer than remote
 */
export async function isSyncNeeded(
  userId: string,
  localDataTimestamp: number
): Promise<boolean> {
  try {
    if (!userId) return false;

    // Get the most recently updated product
    const { data } = await supabase
      .from('products')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return true; // No data in Supabase, sync needed

    const remoteTimestamp = new Date(data[0].updated_at).getTime();
    return localDataTimestamp > remoteTimestamp;
  } catch (err) {
    console.error('❌ Error checking sync status:', err);
    return true; // On error, assume sync is needed for safety
  }
}
