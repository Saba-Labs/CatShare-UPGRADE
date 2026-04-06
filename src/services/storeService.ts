/**
 * Store Service
 *
 * Handles all operations for persistent seller stores:
 * - Create, read, update, delete stores
 * - Slug validation and uniqueness checks
 * - Public access via RPC for customer views
 */

import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';

/**
 * RPC may return jsonb as object or string; unwrap common shapes.
 */
function parseStoreProductsRpcPayload(raw: unknown): unknown[] {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== 'object') return [];
  const o = v as Record<string, unknown>;
  if (Array.isArray(o.products)) return o.products;
  if (Array.isArray(o.Products)) return o.Products;
  if (Array.isArray(o.items)) return o.items;
  return [];
}

function parseCatalogueDataField(value: unknown): ProductWithCatalogueData['catalogueData'] | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return undefined;
    try {
      const p = JSON.parse(t);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as ProductWithCatalogueData['catalogueData']) : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as ProductWithCatalogueData['catalogueData'];
  }
  return undefined;
}

/**
 * Public store reads products from `get_store_products` (merged `p.data` + row fields).
 * Normalize nested `data`, snake_case keys, and stable `id` so catalogueData / prices / imageUrl match the app.
 */
function normalizePublicStoreProduct(raw: Record<string, unknown>): ProductWithCatalogueData {
  const inner =
    typeof raw.data === 'object' && raw.data !== null && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};
  const merged: Record<string, unknown> = { ...inner, ...raw };
  delete merged.data;

  const catalogueData =
    parseCatalogueDataField(merged.catalogueData) ??
    parseCatalogueDataField(merged.catalogue_data);

  const pid = merged.product_id ?? merged.productId;
  const id = pid != null ? String(pid) : merged.id != null ? String(merged.id) : '';

  const imageUrlRaw =
    (typeof merged.imageUrl === 'string' && merged.imageUrl.trim()) ||
    (typeof merged.image_url === 'string' && merged.image_url.trim()) ||
    '';

  let category: string[] = [];
  if (Array.isArray(merged.category)) {
    category = merged.category.map((c) => String(c).trim()).filter(Boolean);
  } else if (merged.category != null && String(merged.category).trim() !== '') {
    category = [String(merged.category).trim()];
  }

  const base = { ...(merged as unknown as ProductWithCatalogueData) };
  return {
    ...base,
    id,
    catalogueData: catalogueData ?? base.catalogueData,
    imageUrl: imageUrlRaw || base.imageUrl,
    category,
  };
}

export interface Store {
  id: string;
  sellerUserId: string;
  storeSlug: string;
  catalogueId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StorePublic {
  storeId: string;
  sellerUserId: string;
  storeSlug: string;
  catalogueId: string;
  sellerCurrencyCode: string;
  sellerLogoUrl: string;
  createdAt: string;
}

/**
 * Validate a store slug
 * - Alphanumeric + hyphens only
 * - 3-50 characters
 * - Not reserved word
 */
export function validateStoreSlug(slug: string): { valid: boolean; error?: string } {
  const reservedWords = ['admin', 'api', 'store', 'o', 'orders', 'create-order', 'account', 'login', 'register', 'logout', 'home', 'dashboard', 'settings', 'share'];
  
  const trimmed = slug.trim().toLowerCase();
  
  if (!trimmed) {
    return { valid: false, error: 'Slug cannot be empty' };
  }
  
  if (trimmed.length < 3) {
    return { valid: false, error: 'Slug must be at least 3 characters' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Slug must not exceed 50 characters' };
  }
  
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }
  
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }
  
  if (trimmed.includes('--')) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' };
  }
  
  if (reservedWords.includes(trimmed)) {
    return { valid: false, error: `"${slug}" is a reserved word. Please choose another slug` };
  }
  
  return { valid: true };
}

/**
 * Generate alternative slug suggestions when a slug is taken
 */
export function generateSlugAlternatives(baseSlug: string, maxSuggestions = 3): string[] {
  const suggestions: string[] = [];
  const base = baseSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  for (let i = 2; i < maxSuggestions + 2; i++) {
    suggestions.push(`${base}-${i}`);
  }
  
  return suggestions;
}

/**
 * Create a new store for a seller
 * Returns the created store or error with conflict info
 */
export async function createStore(
  sellerUserId: string,
  storeSlug: string,
  catalogueId: string
): Promise<{ success: boolean; data?: Store; error?: string; suggestedSlugs?: string[] }> {
  try {
    // Validate slug
    const validation = validateStoreSlug(storeSlug);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const client = getSupabaseClient();
    const normalizedSlug = storeSlug.toLowerCase().trim();

    // Set RLS user ID for the request
    setSupabaseRlsUserId(sellerUserId);

    // Check if seller already has a store
    const { data: existingStore, error: fetchError } = await client
      .from('stores')
      .select('id')
      .eq('seller_user_id', sellerUserId)
      .limit(1);
    
    if (fetchError) {
      console.error('❌ Error checking existing store:', fetchError);
      return { success: false, error: 'Failed to check existing store' };
    }
    
    if (existingStore && existingStore.length > 0) {
      return { success: false, error: 'You already have a store. Update your existing store instead of creating a new one.' };
    }
    
    // Attempt to create store
    const { data, error } = await client
      .from('stores')
      .insert({
        seller_user_id: sellerUserId,
        store_slug: normalizedSlug,
        catalogue_id: catalogueId,
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating store:', error);
      
      // Check if it's a slug uniqueness error
      if (error.code === '23505' && error.message.includes('store_slug')) {
        const suggestions = generateSlugAlternatives(normalizedSlug);
        return {
          success: false,
          error: `The slug "${normalizedSlug}" is already taken. Try one of these instead:`,
          suggestedSlugs: suggestions,
        };
      }
      
      return { success: false, error: error.message };
    }
    
    console.log('✅ Store created:', data);
    return {
      success: true,
      data: {
        id: data.id,
        sellerUserId: data.seller_user_id,
        storeSlug: data.store_slug,
        catalogueId: data.catalogue_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in createStore:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

/**
 * Get a store by its slug (public, no auth required)
 * Called by unauthenticated users to view a store
 */
export async function getStoreBySlug(slug: string): Promise<{ success: boolean; data?: StorePublic; error?: string }> {
  try {
    const client = getSupabaseClient();
    const normalizedSlug = slug.toLowerCase().trim();
    
    // Call the public RPC function
    const { data, error } = await client.rpc('get_store_by_slug', {
      p_slug: normalizedSlug,
    });
    
    if (error) {
      console.error('❌ Error fetching store by slug:', error);
      return { success: false, error: error.message };
    }
    
    if (!data) {
      return { success: false, error: 'Store not found' };
    }
    
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in getStoreBySlug:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get a seller's own store (authenticated)
 */
export async function getSellerStore(sellerUserId: string): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();

    // Set RLS user ID for the request
    setSupabaseRlsUserId(sellerUserId);

    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('seller_user_id', sellerUserId)
      .limit(1);
    
    if (error) {
      console.error('❌ Error fetching seller store:', error);
      return { success: false, error: error.message };
    }
    
    if (!data || data.length === 0) {
      return { success: false, error: 'Store not found' };
    }
    
    const store = data[0];
    return {
      success: true,
      data: {
        id: store.id,
        sellerUserId: store.seller_user_id,
        storeSlug: store.store_slug,
        catalogueId: store.catalogue_id,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in getSellerStore:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

/**
 * Update a store's slug (seller operation)
 */
export async function updateStoreSlug(
  sellerUserId: string,
  newSlug: string
): Promise<{ success: boolean; data?: Store; error?: string; suggestedSlugs?: string[] }> {
  try {
    const validation = validateStoreSlug(newSlug);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const client = getSupabaseClient();
    const normalizedSlug = newSlug.toLowerCase().trim();

    // Set RLS user ID for the request
    setSupabaseRlsUserId(sellerUserId);
    
    const { data, error } = await client
      .from('stores')
      .update({
        store_slug: normalizedSlug,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating store slug:', error);
      
      if (error.code === '23505' && error.message.includes('store_slug')) {
        const suggestions = generateSlugAlternatives(normalizedSlug);
        return {
          success: false,
          error: `The slug "${normalizedSlug}" is already taken. Try one of these instead:`,
          suggestedSlugs: suggestions,
        };
      }
      
      return { success: false, error: error.message };
    }
    
    console.log('✅ Store slug updated:', data);
    return {
      success: true,
      data: {
        id: data.id,
        sellerUserId: data.seller_user_id,
        storeSlug: data.store_slug,
        catalogueId: data.catalogue_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreSlug:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

/**
 * Update a store's linked catalogue (seller operation)
 */
export async function updateStoreCatalogue(
  sellerUserId: string,
  newCatalogueId: string
): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();

    // Set RLS user ID for the request
    setSupabaseRlsUserId(sellerUserId);
    
    const { data, error } = await client
      .from('stores')
      .update({
        catalogue_id: newCatalogueId,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating store catalogue:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Store catalogue updated:', data);
    return {
      success: true,
      data: {
        id: data.id,
        sellerUserId: data.seller_user_id,
        storeSlug: data.store_slug,
        catalogueId: data.catalogue_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreCatalogue:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete a seller's store
 */
export async function deleteStore(sellerUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();

    // Set RLS user ID for the request
    setSupabaseRlsUserId(sellerUserId);

    const { error } = await client
      .from('stores')
      .delete()
      .eq('seller_user_id', sellerUserId);

    if (error) {
      console.error('❌ Error deleting store:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Store deleted');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in deleteStore:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get products for a store (public, no auth required)
 * Called by guests to view products from a specific store
 * Requires the RPC function get_store_products() in Supabase
 */
export async function getStoreProducts(
  sellerUserId: string
): Promise<{ success: boolean; products?: any[]; error?: string }> {
  try {
    const client = getSupabaseClient();

    // Call the public RPC function
    const { data, error } = await client.rpc('get_store_products', {
      p_seller_user_id: sellerUserId,
    });

    if (error) {
      console.error('❌ Error fetching store products:', error);
      return { success: false, error: error.message };
    }

    if (data == null) {
      return { success: true, products: [] };
    }

    const list = parseStoreProductsRpcPayload(data);
    const products = list
      .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object' && !Array.isArray(x))
      .map((row) => normalizePublicStoreProduct(row));

    return { success: true, products };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in getStoreProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
