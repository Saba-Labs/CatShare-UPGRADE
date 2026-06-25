/**
 * Supabase Sync Service
 * Handles all data synchronization between local state and Supabase
 */

import { getSupabaseClient, CATSHARE_CLOUD_FETCH_OK_EVENT } from '../supabaseClient';
import { assertProductsHaveCloudImageUrlForSync } from '../utils/syncImageValidation';
import { getAllProductImageUrlsForDeletion, normalizeProductImageFields } from '../utils/productImages';
import { mapWithConcurrencyLimit } from '../utils/concurrencyPool';
import { deleteImageFromR2, deleteAllProductImagesFromR2 } from './cloudflareService';
import { syncTopLevelFieldsIntoCatalogueData, type ProductWithCatalogueData } from '../config/catalogueProductUtils';
import { getAllCatalogues, DEFAULT_CATALOGUES, type Catalogue } from '../config/catalogueConfig';

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

    const catalogues = getAllCatalogues();
    const cleanedProducts = products.map(p => {
      // Snapshot catalogueData before syncTopLevelFieldsIntoCatalogueData overwrites enabled flags
      const catalogueDataSnapshot = p.catalogueData
        ? JSON.parse(JSON.stringify(p.catalogueData))
        : null;

      const reconciled = syncTopLevelFieldsIntoCatalogueData(
        p as ProductWithCatalogueData,
        catalogues
      );
      const clean = { ...reconciled };

      // Restore full catalogueData from snapshot — reconcile must not drop bulk-edited rows/fields.
      if (catalogueDataSnapshot) {
        clean.catalogueData = JSON.parse(JSON.stringify(catalogueDataSnapshot));
      }

      clean.updatedAt = new Date().toISOString();
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
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
        imageUrl: p.data?.imageUrl || 'N/A',
        position: p.position,
      })),
      firstRowStructure: upsertData[0] ? {
        keys: Object.keys(upsertData[0]),
        dataKeys: upsertData[0].data ? Object.keys(upsertData[0].data).slice(0, 5) : 'N/A',
      } : 'No data',
    });

    const { data, error } = await getSupabaseClient()
      .from('products')
      .upsert(upsertData, { onConflict: 'user_id,product_id' })
      .select();

    if (error) {
      const errorMsg = error.message || JSON.stringify(error);
      console.error('❌ Error syncing products to Supabase:', {
        message: errorMsg,
        code: error.code || 'N/A',
        details: error.details || 'N/A',
        fullError: error,
      });
      return { success: false, error: errorMsg };
    }

    console.log(`✅ Synced ${cleanedProducts.length} products to Supabase`, {
      withImageUrl: upsertData.filter(p => p.data?.imageUrl).length,
      total: cleanedProducts.length
    });
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('❌ Exception in syncProducts:', {
      message: errorMessage,
      error: err,
    });
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

    const delCat = getAllCatalogues();
    const upsertData = deletedProducts.map(product => {
      const reconciled = syncTopLevelFieldsIntoCatalogueData(
        product as ProductWithCatalogueData,
        delCat
      );
      return {
        user_id: userId,
        product_id: product.id,
        data: reconciled,
        deleted_at: product.deletedAt || new Date().toISOString(),
      };
    });

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
      const errorMsg = error.message || JSON.stringify(error);
      console.error('❌ Error syncing deleted products:', {
        message: errorMsg,
        code: error.code || 'N/A',
        details: error.details || 'N/A',
        fullError: error,
      });
      return { success: false, error: errorMsg };
    }

    console.log(`✅ Synced ${deletedProducts.length} deleted products (with full data) to Supabase`);
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('❌ Exception in syncDeletedProducts:', {
      message: errorMessage,
      error: err,
    });
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
    const imageRows = rows.filter((r: any) => getAllProductImageUrlsForDeletion(r.data).length > 0);
    if (imageRows.length > 0) {
      console.log(`🗑️ Deleting ${imageRows.length} product image sets from R2`);
      const results = await mapWithConcurrencyLimit(
        imageRows,
        4,
        async (r: any) => deleteAllProductImagesFromR2(r.data)
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        console.warn(`⚠️ ${failed.length} R2 deletions failed, queuing for later cleanup`);
        for (let i = 0; i < failed.length; i++) {
          try {
            for (const u of getAllProductImageUrlsForDeletion(imageRows[i].data)) {
              await queueR2Cleanup(userId, u);
            }
          } catch {
            /* best effort */
          }
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

    /** Prefer `data` JSON; older rows may only have flat columns — without this, cache stays empty. */
    const mapProductsTableRowToApp = (p: any): any | null => {
      if (!p) return null;
      if (p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)) {
        const row = { ...p.data };
        if (row.id == null && p.product_id != null) row.id = p.product_id;
        return row.id != null ? normalizeProductImageFields(row) : null;
      }
      if (p.product_id != null) {
        return {
          id: p.product_id,
          name: p.name ?? '',
          sku: p.sku ?? null,
          categoryId: p.category_id ?? null,
        };
      }
      return null;
    };

    const mapDeletedProductsRowToApp = (dp: any): any | null => {
      if (!dp) return null;
      if (dp.data != null && typeof dp.data === 'object' && !Array.isArray(dp.data)) {
        const row = { ...dp.data, id: dp.product_id ?? dp.data?.id };
        return row.id != null ? normalizeProductImageFields(row) : null;
      }
      if (dp.product_id != null) {
        return { id: dp.product_id, name: dp.name ?? '', sku: dp.sku ?? null };
      }
      return null;
    };

    const rawCatDef = cataloguesDef?.[0]?.data as { catalogues?: Catalogue[] } | null | undefined;
    let reconcileCatalogues: Catalogue[] = DEFAULT_CATALOGUES;
    if (
      rawCatDef &&
      typeof rawCatDef === 'object' &&
      Array.isArray(rawCatDef.catalogues) &&
      rawCatDef.catalogues.length > 0
    ) {
      reconcileCatalogues = rawCatDef.catalogues;
    }

    // deleted_products now stores full product data in the `data` column.
    // No cross-referencing with the products table needed.
    const deletedProductsList = (deletedProducts || [])
      .map(mapDeletedProductsRowToApp)
      .filter((p: any) => p != null && p.id != null)
      .map((p: any) =>
        syncTopLevelFieldsIntoCatalogueData(p as ProductWithCatalogueData, reconcileCatalogues)
      );

    // Filter active products: exclude any that are in deleted_products
    const deletedIds = new Set(deletedProductsList.map((p: any) => String(p.id)));
    const activeProducts = (products?.map(mapProductsTableRowToApp) || [])
      .filter((p: any) => p != null && p.id != null && !deletedIds.has(String(p.id)))
      .map((p: any) =>
        syncTopLevelFieldsIntoCatalogueData(p as ProductWithCatalogueData, reconcileCatalogues)
      );

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(CATSHARE_CLOUD_FETCH_OK_EVENT, { detail: { userId } })
      );
    }
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

    // Step 2: Delete product images from Cloudflare R2 if any exist.
    const shelfData = shelfRow?.data;
    if (shelfData && getAllProductImageUrlsForDeletion(shelfData).length > 0) {
      console.log(`🗑️ Attempting to delete R2 image(s) for product ${normalizedProductId}`);
      const deleteResult = await deleteAllProductImagesFromR2(shelfData);

      if (!deleteResult.success) {
        console.warn('⚠️ R2 delete failed, queuing for later cleanup:', deleteResult.error);
        try {
          for (const u of getAllProductImageUrlsForDeletion(shelfData)) {
            await queueR2Cleanup(userId, u);
          }
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

/**
 * Completely delete a user account and all associated data from Supabase and R2.
 * This is irreversible and removes all products, settings, and storage.
 */
export async function deleteUserAccount(userId: string): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    const client = getSupabaseClient();
    console.log(`🗑️ Starting complete account deletion for user ${userId}`);

    // Step 1: Delete all images from R2 (both active products and deleted products)
    console.log('📦 Fetching all product images for R2 cleanup...');

    // Get active products
    const { data: activeProducts, error: activeError } = await client
      .from('products')
      .select('product_id, data')
      .eq('user_id', userId);

    // Get deleted products
    const { data: deletedProducts, error: deletedError } = await client
      .from('deleted_products')
      .select('product_id, data')
      .eq('user_id', userId);

    if (activeError && activeError.code !== 'PGRST116') {
      console.warn('⚠️ Error fetching active products:', activeError);
    }
    if (deletedError && deletedError.code !== 'PGRST116') {
      console.warn('⚠️ Error fetching deleted products:', deletedError);
    }

    const allProducts = [...(activeProducts || []), ...(deletedProducts || [])];
    const imageRows = allProducts.filter((r: any) => getAllProductImageUrlsForDeletion(r.data).length > 0);

    if (imageRows.length > 0) {
      console.log(`🗑️ Deleting ${imageRows.length} product sets from R2`);
      const results = await mapWithConcurrencyLimit(
        imageRows,
        4,
        async (r: any) => deleteAllProductImagesFromR2(r.data)
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        console.warn(`⚠️ ${failed.length} R2 deletions failed during account deletion`);
      }
    }

    // Step 2: Delete all user data from Supabase tables
    console.log('🗑️ Deleting all user data from Supabase...');

    const tablesToDelete = [
      'products',
      'deleted_products',
      'categories',
      'catalogues_definition',
      'fields_definition',
      'user_settings',
      'user_push_tokens',
      'r2_cleanup_queue'
    ];

    for (const table of tablesToDelete) {
      const { error } = await client
        .from(table)
        .delete()
        .eq('user_id', userId);

      if (error && error.code !== 'PGRST116') {
        console.warn(`⚠️ Error deleting from ${table}:`, error.message);
      } else {
        console.log(`✅ Deleted user data from ${table}`);
      }
    }

    console.log(`✅ Account deletion complete for user ${userId}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in deleteUserAccount:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
