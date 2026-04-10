/**
 * Supabase Sync Service
 * Handles all data synchronization between local state and Supabase
 */

import { getSupabaseClient } from '../supabaseClient';
import { assertProductsHaveCloudImageUrlForSync } from '../utils/syncImageValidation';
import { mapWithConcurrencyLimit } from '../utils/concurrencyPool';
import { deleteImageFromR2 } from './cloudflareService';

interface SyncResult {
  success: boolean;
  error?: string;
  data?: any;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type SyncProductsOptions = {
  skipImageUrlAssertion?: boolean;
  /** When syncing a subset of rows, pass the full ordered list so `position` matches drag order in the app. */
  fullListForPosition?: any[];
};

/**
 * Sync products to Supabase
 * @param syncOptions.skipImageUrlAssertion — set true only for rare callers (e.g. raw backup JSON) that have not run the R2 upload step yet.
 */
export async function syncProducts(
  userId: string,
  products: any[],
  syncOptions?: SyncProductsOptions
): Promise<SyncResult> {
  try {
    if (!userId || !Array.isArray(products)) {
      return { success: false, error: 'Invalid input: userId or products array missing' };
    }

    const cleanedProducts = products.map(p => {
      const clean = { ...p };
      // Remove large binary data fields but PRESERVE imageUrl (cloud URL)
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
      // imageUrl is intentionally preserved - it's the Cloudflare R2 URL needed for sync
      return clean;
    });

    if (!syncOptions?.skipImageUrlAssertion) {
      assertProductsHaveCloudImageUrlForSync(cleanedProducts, 'syncProducts');
    }

    const upsertData = cleanedProducts.map((product, index) => {
      let position = index;
      const full = syncOptions?.fullListForPosition;
      if (full && Array.isArray(full) && full.length > 0) {
        const gi = full.findIndex((p: any) => p != null && String(p.id) === String(product.id));
        if (gi >= 0) position = gi;
      }
      return {
        user_id: userId,
        product_id: product.id,
        name: product.name || '',
        sku: product.sku || null,
        category_id: product.categoryId || null,
        data: product,
        position,
        updated_at: new Date().toISOString(),
      };
    });

    if (upsertData.length === 0) {
      return { success: true, data: [] };
    }

    // Log details about products being synced (including imageUrl presence)
    console.log(`📤 Syncing ${upsertData.length} products to Supabase:`, {
      count: upsertData.length,
      productsWithImageUrl: upsertData.filter(p => p.data?.imageUrl).length,
      samples: upsertData.slice(0, 2).map(p => ({
        id: p.product_id,
        name: p.name,
        hasImageUrl: !!p.data?.imageUrl,
        imageUrl: p.data?.imageUrl || 'N/A'
      }))
    });

    const { data, error } = await getSupabaseClient()
      .from('products')
      .upsert(upsertData, { onConflict: 'user_id,product_id' })
      .select();

    if (error) {
      console.error('❌ Error syncing products to Supabase:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Synced ${cleanedProducts.length} products to Supabase`, {
      withImageUrl: upsertData.filter(p => p.data?.imageUrl).length,
      total: cleanedProducts.length
    });
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Remove specific products from the products table (used when products move to shelf).
 */
export async function removeFromProductsTable(
  userId: string,
  productIds: string[]
): Promise<void> {
  if (!userId || productIds.length === 0) return;
  try {
    const { error } = await getSupabaseClient()
      .from('products')
      .delete()
      .eq('user_id', userId)
      .in('product_id', productIds);
    if (error) {
      console.warn('⚠️ removeFromProductsTable error:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ removeFromProductsTable request failed:', getErrorMessage(err));
  }
}

/**
 * Remove specific products from the deleted_products table (used when products are restored).
 */
export async function removeFromDeletedProductsTable(
  userId: string,
  productIds: string[]
): Promise<void> {
  if (!userId || productIds.length === 0) return;
  try {
    const { error } = await getSupabaseClient()
      .from('deleted_products')
      .delete()
      .eq('user_id', userId)
      .in('product_id', productIds);
    if (error) {
      console.warn('⚠️ removeFromDeletedProductsTable error:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ removeFromDeletedProductsTable request failed:', getErrorMessage(err));
  }
}

/**
 * Sync deleted products to Supabase with full product data.
 * The deleted_products table stores the complete product in its `data` column
 * so shelf items are self-contained and don't need cross-referencing.
 */
export async function syncDeletedProducts(
  userId: string,
  deletedProducts: any[],
  syncOptions?: { skipImageUrlAssertion?: boolean }
): Promise<SyncResult> {
  try {
    if (!userId || !Array.isArray(deletedProducts)) {
      return { success: false, error: 'Invalid input: userId or deletedProducts array missing' };
    }

    const upsertData = deletedProducts.map(product => ({
      user_id: userId,
      product_id: product.id,
      data: product,
      deleted_at: product.deletedAt || new Date().toISOString(),
    }));

    if (upsertData.length === 0) {
      return { success: true, data: [] };
    }

    if (!syncOptions?.skipImageUrlAssertion) {
      assertProductsHaveCloudImageUrlForSync(deletedProducts, 'syncDeletedProducts');
    }

    const { data, error } = await getSupabaseClient()
      .from('deleted_products')
      .upsert(upsertData, { onConflict: 'user_id,product_id' })
      .select();

    if (error) {
      console.error('❌ Error syncing deleted products:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Synced ${deletedProducts.length} deleted products (with full data) to Supabase`);
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncDeletedProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete all shelf products from Supabase permanently.
 * Reads image URLs from deleted_products.data, cleans R2, then deletes rows.
 */
export async function deleteAllDeletedProducts(userId: string): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid input: userId missing' };
    }

    const client = getSupabaseClient();

    // Step 1: Fetch all shelf products with their full data for R2 cleanup
    const { data: shelfRows, error: fetchError } = await client
      .from('deleted_products')
      .select('product_id, data')
      .eq('user_id', userId);

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching shelf products:', fetchError);
      return { success: false, error: fetchError.message };
    }

    const rows = shelfRows || [];

    // Step 2: Delete images from R2. Queue failures instead of blocking.
    const imageRows = rows.filter((r: any) => r.data?.imageUrl);
    if (imageRows.length > 0) {
      console.log(`🗑️ Deleting ${imageRows.length} images from R2`);
      const results = await mapWithConcurrencyLimit(
        imageRows,
        4,
        async (r: any) => deleteImageFromR2(r.data.imageUrl)
      );
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.warn(`⚠️ ${failed.length} R2 deletions failed, queuing for later cleanup`);
        for (let i = 0; i < failed.length; i++) {
          try {
            await queueR2Cleanup(userId, imageRows[i].data.imageUrl);
          } catch { /* best effort */ }
        }
      }
    }

    // Step 3: Delete all rows from deleted_products table
    const { error: deleteShelfError } = await client
      .from('deleted_products')
      .delete()
      .eq('user_id', userId);

    if (deleteShelfError) {
      console.error('❌ Error deleting from shelf:', deleteShelfError);
      return { success: false, error: deleteShelfError.message };
    }

    console.log(`✅ Permanently deleted all ${rows.length} shelf products from Supabase`);
    return { success: true, data: { deletedCount: rows.length } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in deleteAllDeletedProducts:', errorMessage);
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

    // Strict/replace semantics:
    // categories are "catalogue metadata" that should match the offline snapshot exactly.
    // So we delete existing categories for the user first.
    const { error: deleteError } = await getSupabaseClient()
      .from('categories')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error deleting old categories:', deleteError);
      return { success: false, error: deleteError.message };
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

    const { data, error } = await getSupabaseClient()
      .from('categories')
      .insert(upsertData)
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

    const { error: deleteError } = await getSupabaseClient()
      .from('catalogues_definition')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error deleting old catalogue definition:', deleteError);
      return { success: false, error: deleteError.message };
    }

    const { data, error } = await getSupabaseClient()
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

    const { error: deleteError } = await getSupabaseClient()
      .from('fields_definition')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error deleting old fields definition:', deleteError);
      return { success: false, error: deleteError.message };
    }

    const { data, error } = await getSupabaseClient()
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
 * Merge `user_settings.data` JSON so partial updates (e.g. watermark) don't wipe `businessProfile`.
 */
function mergeUserSettingsData(existing: any, incoming: any): Record<string, unknown> {
  const ex = existing && typeof existing === 'object' ? existing : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};
  const out: Record<string, unknown> = { ...ex, ...inc };
  const exBp = ex.businessProfile;
  const inBp = inc.businessProfile;
  if (
    (exBp && typeof exBp === 'object') ||
    (inBp && typeof inBp === 'object')
  ) {
    out.businessProfile = {
      ...(typeof exBp === 'object' && exBp ? exBp : {}),
      ...(typeof inBp === 'object' && inBp ? inBp : {}),
    };
  }
  return out;
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

    const { data: existingRow, error: fetchErr } = await getSupabaseClient()
      .from('user_settings')
      .select('id, data')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      const errorMsg = fetchErr.message || JSON.stringify(fetchErr) || 'Unknown error';
      console.error('❌ Error reading user settings:', errorMsg);
      return { success: false, error: errorMsg };
    }

    if (existingRow) {
      const payload: Record<string, unknown> = {
        ...settings,
        updated_at: new Date().toISOString(),
      };
      if (Object.prototype.hasOwnProperty.call(settings, 'data') && settings.data !== undefined) {
        payload.data = mergeUserSettingsData(existingRow.data, settings.data);
      }

      const { data, error } = await getSupabaseClient()
        .from('user_settings')
        .update(payload as any)
        .eq('user_id', userId)
        .select();

      if (error) {
        const errorMsg = error.message || JSON.stringify(error) || 'Unknown error';
        console.error('❌ Error updating user settings:', errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('✅ Updated user settings in Supabase');
      return { success: true, data };
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    };
    if (Object.prototype.hasOwnProperty.call(settings, 'data') && settings.data !== undefined) {
      insertPayload.data = mergeUserSettingsData(null, settings.data);
    }

    const { data, error } = await getSupabaseClient()
      .from('user_settings')
      .insert(insertPayload as any)
      .select();

    if (error) {
      const errorMsg = error.message || JSON.stringify(error) || 'Unknown error';
      console.error('❌ Error creating user settings:', errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('✅ Created user settings in Supabase');
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in syncUserSettings:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch all user data from Supabase
 */
export async function fetchAllUserData(userId: string): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid input: userId missing' };
    }

    const client = getSupabaseClient();

    const settle = async <T,>(label: string, request: Promise<T>): Promise<T | null> => {
      try {
        return await request;
      } catch (err) {
        console.warn(`⚠️ ${label} request failed:`, getErrorMessage(err));
        return null;
      }
    };

    const [
      productsResult,
      deletedProductsResult,
      categoriesResult,
      cataloguesDefResult,
      fieldsDefResult,
      settingsResult,
    ] = await Promise.all([
      settle('products fetch', (client.from('products').select('*').eq('user_id', userId).order('position', { ascending: true })) as unknown as Promise<any>),
      settle('deleted products fetch', (client.from('deleted_products').select('*').eq('user_id', userId)) as unknown as Promise<any>),
      settle('categories fetch', (client.from('categories').select('*').eq('user_id', userId)) as unknown as Promise<any>),
      settle('catalogues definition fetch', (client.from('catalogues_definition').select('*').eq('user_id', userId)) as unknown as Promise<any>),
      settle('fields definition fetch', (client.from('fields_definition').select('*').eq('user_id', userId)) as unknown as Promise<any>),
      settle('user settings fetch', (client.from('user_settings').select('*').eq('user_id', userId).maybeSingle()) as unknown as Promise<any>),
    ]);

    const products = productsResult?.data;
    const deletedProducts = deletedProductsResult?.data;
    const categories = categoriesResult?.data;
    const cataloguesDef = cataloguesDefResult?.data;
    const fieldsDef = fieldsDefResult?.data;
    const settings = settingsResult?.data;

    const productsError = productsResult?.error;
    const deletedError = deletedProductsResult?.error;
    const categoriesError = categoriesResult?.error;
    const cataloguesError = cataloguesDefResult?.error;
    const fieldsError = fieldsDefResult?.error;
    const settingsError = settingsResult?.error;

    if (!productsResult) {
      return { success: false, error: 'Failed to fetch products' };
    }
    if (productsError && productsError.code !== 'PGRST116') {
      console.warn('⚠️ Error fetching products:', getErrorMessage(productsError));
      return { success: false, error: productsError.message };
    }
    if (!deletedProductsResult) console.warn('⚠️ deleted products fetch returned no result');
    if (!categoriesResult) console.warn('⚠️ categories fetch returned no result');
    if (!cataloguesDefResult) console.warn('⚠️ catalogues definition fetch returned no result');
    if (!fieldsDefResult) console.warn('⚠️ fields definition fetch returned no result');
    if (!settingsResult) console.warn('⚠️ user settings fetch returned no result');
    if (deletedError && deletedError.code !== 'PGRST116') console.warn('⚠️ Error fetching deleted products:', getErrorMessage(deletedError));
    if (categoriesError && categoriesError.code !== 'PGRST116') console.warn('⚠️ Error fetching categories:', getErrorMessage(categoriesError));
    if (cataloguesError && cataloguesError.code !== 'PGRST116') console.warn('⚠️ Error fetching catalogues definition:', getErrorMessage(cataloguesError));
    if (fieldsError && fieldsError.code !== 'PGRST116') console.warn('⚠️ Error fetching fields definition:', getErrorMessage(fieldsError));
    if (settingsError && settingsError.code !== 'PGRST116') console.warn('⚠️ Error fetching user settings:', getErrorMessage(settingsError));

    // deleted_products now stores full product data in the `data` column.
    // No cross-referencing with the products table needed.
    const deletedProductsList = (deletedProducts || [])
      .map((dp: any) => {
        if (dp.data) {
          return { ...dp.data, id: dp.product_id };
        }
        return null;
      })
      .filter((p: any) => p !== null);

    // Filter active products: exclude any that are in deleted_products
    const deletedIds = new Set(deletedProductsList.map((p: any) => p.id));
    const activeProducts = (products?.map((p: any) => p.data) || [])
      .filter((p: any) => !deletedIds.has(p?.id));

    const userData = {
      products: activeProducts,
      deletedProducts: deletedProductsList,
      categories: categories?.map((c: any) => c.data) || [],
      cataloguesDefinition: cataloguesDef?.[0]?.data || null,
      fieldsDefinition: fieldsDef?.[0]?.data || null,
      userSettings: settings || null,
    };

    console.log('✅ Fetched all user data from Supabase', {
      productsCount: userData.products.length,
      deletedProductsCount: userData.deletedProducts.length,
    });
    return { success: true, data: userData };
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.warn('⚠️ Exception in fetchAllUserData:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Permanently delete a product from Supabase.
 * Product lives in deleted_products (shelf) — delete from there and clean up R2 image.
 */
export async function deleteProductFromSupabase(
  userId: string,
  productId: string
): Promise<SyncResult> {
  try {
    const normalizedProductId = String(productId ?? '').trim();
    if (!userId || !normalizedProductId) {
      return { success: false, error: 'Invalid input: userId or productId missing' };
    }

    const client = getSupabaseClient();

    // Step 1: Fetch the shelf product to get the imageUrl before deleting
    const { data: shelfRow, error: fetchError } = await client
      .from('deleted_products')
      .select('data')
      .eq('user_id', userId)
      .eq('product_id', normalizedProductId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('⚠️ Warning fetching shelf product for R2 cleanup:', fetchError.message);
    }

    // Step 2: Delete image from Cloudflare R2 if it exists.
    const imageUrl = shelfRow?.data?.imageUrl;
    if (imageUrl) {
      console.log(`🗑️ Attempting to delete R2 image for product ${normalizedProductId}`);
      const deleteResult = await deleteImageFromR2(imageUrl);

      if (!deleteResult.success) {
        console.warn('⚠️ R2 delete failed, queuing for later cleanup:', deleteResult.error);
        try {
          await queueR2Cleanup(userId, imageUrl);
        } catch (queueErr) {
          console.warn('⚠️ Could not queue R2 cleanup:', queueErr);
        }
      }
    }

    // Step 3: Delete from deleted_products table
    const { error: deleteFromShelfError } = await client
      .from('deleted_products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', normalizedProductId);

    if (deleteFromShelfError) {
      console.error('❌ Error removing from shelf:', deleteFromShelfError);
      return { success: false, error: deleteFromShelfError.message };
    }

    // Step 4: Also clean up from products table (in case it still exists from old sync)
    await client
      .from('products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', normalizedProductId);

    console.log(`✅ Permanently deleted product ${normalizedProductId} from Supabase`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in deleteProductFromSupabase:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Remove a product from deleted_products table (used when restoring from shelf)
 */
export async function removeProductFromDeletedProducts(
  userId: string,
  productId: string
): Promise<SyncResult> {
  try {
    const normalizedProductId = String(productId ?? '').trim();
    if (!userId || !normalizedProductId) {
      return { success: false, error: 'Invalid input: userId or productId missing' };
    }

    const { data, error } = await getSupabaseClient()
      .from('deleted_products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', normalizedProductId)
      .select('product_id');

    if (error) {
      console.error('❌ Error removing product from shelf:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: `Shelf item not found in Supabase for product_id=${normalizedProductId} (nothing deleted).`,
      };
    }

    console.log(`✅ Removed product ${normalizedProductId} from shelf in Supabase`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in removeProductFromDeletedProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if sync is needed
 */
export async function isSyncNeeded(
  userId: string,
  localDataTimestamp: number
): Promise<boolean> {
  try {
    if (!userId) return false;

    const { data } = await getSupabaseClient()
      .from('products')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return true;

    const remoteTimestamp = new Date(data[0].updated_at).getTime();
    return localDataTimestamp > remoteTimestamp;
  } catch (err) {
    console.error('❌ Error checking sync status:', err);
    return true;
  }
}

/**
 * Queue a failed R2 image deletion for later retry.
 */
export async function queueR2Cleanup(userId: string, imageUrl: string): Promise<void> {
  try {
    const { error } = await getSupabaseClient()
      .from('r2_cleanup_queue')
      .insert({ user_id: userId, image_url: imageUrl });

    if (error) {
      console.warn('⚠️ Failed to queue R2 cleanup:', error.message);
    } else {
      console.log('📋 Queued R2 cleanup for:', imageUrl);
    }
  } catch (err) {
    console.warn('⚠️ Failed to queue R2 cleanup request:', getErrorMessage(err));
  }
}

/**
 * Process pending R2 cleanup queue items.
 * Retries deleting orphaned images and removes successful entries.
 */
export async function processR2CleanupQueue(userId: string): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { data: pending, error } = await client
      .from('r2_cleanup_queue')
      .select('id, image_url')
      .eq('user_id', userId)
      .limit(20);

    if (error || !pending || pending.length === 0) return;

    console.log(`🧹 Processing ${pending.length} R2 cleanup queue items`);

    for (const item of pending) {
      const result = await deleteImageFromR2(item.image_url);
      if (result.success) {
        await client
          .from('r2_cleanup_queue')
          .delete()
          .eq('id', item.id);
        console.log(`✅ Cleaned up R2 image: ${item.image_url}`);
      } else {
        console.warn(`⚠️ R2 cleanup retry failed for ${item.image_url}: ${result.error}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ processR2CleanupQueue error:', err);
  }
}
