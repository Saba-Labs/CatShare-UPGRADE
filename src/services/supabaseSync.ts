/**
 * Supabase Sync Service
 * Handles all data synchronization between local state and Supabase
 */

import { getSupabaseClient } from '../supabaseClient';

interface SyncResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Sync products to Supabase
 */
export async function syncProducts(
  userId: string,
  products: any[]
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

    const upsertData = cleanedProducts.map(product => ({
      user_id: userId,
      product_id: product.id,
      name: product.name || '',
      sku: product.sku || null,
      category_id: product.categoryId || null,
      data: product,
      updated_at: new Date().toISOString(),
    }));

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

    const { data, error } = await getSupabaseClient()
      .from('deleted_products')
      .upsert(upsertData, { onConflict: 'user_id,product_id' })
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
 * Delete all deleted products from Supabase (permanent shelf cleanup)
 * This deletes both from deleted_products table AND the actual products from products table
 */
export async function deleteAllDeletedProducts(userId: string): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid input: userId missing' };
    }

    const client = getSupabaseClient();

    // First, fetch all deleted product IDs for this user
    const { data: deletedProducts, error: fetchError } = await client
      .from('deleted_products')
      .select('product_id')
      .eq('user_id', userId);

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching deleted products:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Extract product IDs
    const productIds = deletedProducts?.map(dp => dp.product_id) || [];

    // Delete from deleted_products table
    const { error: deleteShelfError } = await client
      .from('deleted_products')
      .delete()
      .eq('user_id', userId);

    if (deleteShelfError) {
      console.error('❌ Error deleting from shelf:', deleteShelfError);
      return { success: false, error: deleteShelfError.message };
    }

    // Delete the actual products from products table if there are any
    if (productIds.length > 0) {
      const { error: deleteProductsError } = await client
        .from('products')
        .delete()
        .eq('user_id', userId)
        .in('product_id', productIds);

      if (deleteProductsError) {
        console.error('❌ Error deleting products from database:', deleteProductsError);
        return { success: false, error: deleteProductsError.message };
      }

      console.log(`✅ Permanently deleted all ${productIds.length} shelf products from Supabase`);
    } else {
      console.log('✅ Shelf is already empty - no products to delete');
    }

    return { success: true, data: { deletedCount: productIds.length } };
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
      .upsert(upsertData, { onConflict: 'user_id,category_id' })
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

    const { data: existingSettings } = await getSupabaseClient()
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingSettings) {
      const { data, error } = await getSupabaseClient()
        .from('user_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select();

      if (error) {
        const errorMsg = error.message || JSON.stringify(error) || 'Unknown error';
        console.error('❌ Error updating user settings:', errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('✅ Updated user settings in Supabase');
      return { success: true, data };
    } else {
      const { data, error } = await getSupabaseClient()
        .from('user_settings')
        .insert({ user_id: userId, ...settings, updated_at: new Date().toISOString() })
        .select();

      if (error) {
        const errorMsg = error.message || JSON.stringify(error) || 'Unknown error';
        console.error('❌ Error creating user settings:', errorMsg);
        return { success: false, error: errorMsg };
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
 */
export async function fetchAllUserData(userId: string): Promise<SyncResult> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid input: userId missing' };
    }

    const client = getSupabaseClient();

    const [
      { data: products, error: productsError },
      { data: deletedProducts, error: deletedError },
      { data: categories, error: categoriesError },
      { data: cataloguesDef, error: cataloguesError },
      { data: fieldsDef, error: fieldsError },
      { data: settings, error: settingsError },
    ] = await Promise.all([
      client.from('products').select('*').eq('user_id', userId),
      client.from('deleted_products').select('*').eq('user_id', userId),
      client.from('categories').select('*').eq('user_id', userId),
      client.from('catalogues_definition').select('*').eq('user_id', userId),
      client.from('fields_definition').select('*').eq('user_id', userId),
      client.from('user_settings').select('*').eq('user_id', userId).single(),
    ]);

    if (productsError && productsError.code !== 'PGRST116') {
      console.error('❌ Error fetching products:', productsError);
      return { success: false, error: productsError.message };
    }
    if (deletedError && deletedError.code !== 'PGRST116') console.error('❌ Error fetching deleted products:', deletedError);
    if (categoriesError && categoriesError.code !== 'PGRST116') console.error('❌ Error fetching categories:', categoriesError);
    if (cataloguesError && cataloguesError.code !== 'PGRST116') console.error('❌ Error fetching catalogues definition:', cataloguesError);
    if (fieldsError && fieldsError.code !== 'PGRST116') console.error('❌ Error fetching fields definition:', fieldsError);
    if (settingsError && settingsError.code !== 'PGRST116') console.error('❌ Error fetching user settings:', settingsError);

    // Enrich deleted products with their product data from the products table
    let enrichedDeletedProducts = [];
    if (deletedProducts && deletedProducts.length > 0 && products && products.length > 0) {
      // Create a map of product_id -> product data for quick lookup
      const productMap = new Map();
      products.forEach(p => {
        productMap.set(p.product_id, p.data);
      });

      // Map deleted products to include their full product data
      enrichedDeletedProducts = deletedProducts
        .map(dp => {
          const productData = productMap.get(dp.product_id);
          if (productData) {
            return { ...productData, id: dp.product_id };
          }
          return null;
        })
        .filter(p => p !== null);
    }

    const userData = {
      products: products?.map(p => p.data) || [],
      deletedProducts: enrichedDeletedProducts,
      categories: categories?.map(c => c.data) || [],
      cataloguesDefinition: cataloguesDef?.[0]?.data || null,
      fieldsDefinition: fieldsDef?.[0]?.data || null,
      userSettings: settings?.data || null,
    };

    console.log('✅ Fetched all user data from Supabase', {
      productsCount: userData.products.length,
      deletedProductsCount: userData.deletedProducts.length,
      enrichedDeletedProducts: enrichedDeletedProducts.length
    });
    return { success: true, data: userData };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in fetchAllUserData:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Permanently delete a product from Supabase (hard delete from products table)
 */
export async function deleteProductFromSupabase(
  userId: string,
  productId: string
): Promise<SyncResult> {
  try {
    if (!userId || !productId) {
      return { success: false, error: 'Invalid input: userId or productId missing' };
    }

    // First, delete from deleted_products table to remove from shelf
    const { error: deleteFromShelfError } = await getSupabaseClient()
      .from('deleted_products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (deleteFromShelfError) {
      console.error('❌ Error removing from shelf:', deleteFromShelfError);
      return { success: false, error: deleteFromShelfError.message };
    }

    // Then, permanently delete the product from products table
    const { error: deleteError } = await getSupabaseClient()
      .from('products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (deleteError) {
      console.error('❌ Error permanently deleting product:', deleteError);
      return { success: false, error: deleteError.message };
    }

    console.log(`✅ Permanently deleted product ${productId} from Supabase`);
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
    if (!userId || !productId) {
      return { success: false, error: 'Invalid input: userId or productId missing' };
    }

    const { error } = await getSupabaseClient()
      .from('deleted_products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      console.error('❌ Error removing product from shelf:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Removed product ${productId} from shelf in Supabase`);
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
