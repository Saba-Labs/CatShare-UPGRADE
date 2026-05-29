/**
 * Store Service
 *
 * Handles all operations for persistent seller stores:
 * - Create, read, update, delete stores
 * - Slug validation and uniqueness checks
 * - Public access via RPC for customer views
 */

import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import {
  syncTopLevelFieldsIntoCatalogueData,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import {
  tryExtractCataloguesArray,
  DEFAULT_CATALOGUES,
  ensureCataloguesForStorefront,
  type Catalogue,
} from '../config/catalogueConfig';
import { RESERVED_STORE_SLUGS } from '../utils/storefrontDomain';

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** JSONB may be a string, object, or (rare) other — parse string; return value for further checks. */
function parseJsonbValue(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

/** `user_settings.data` is always a JSON object in correct shape; stringified JSONB is handled here. */
function parseUserSettingsDataColumn(raw: unknown): Record<string, unknown> | undefined {
  const v = parseJsonbValue(raw);
  if (v == null) return undefined;
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return undefined;
}

const debugStorefrontCatalogue =
  import.meta.env.DEV === true || String(import.meta.env.VITE_DEBUG_STOREFRONT || '') === 'true';

/**
 * `get_store_by_slug` (security definer) can embed catalogue JSON so anon clients do not rely on RLS `user_settings` / `catalogues_definition` reads.
 */
function extractCataloguesListFromStoreRpcPayload(row: Record<string, unknown>): Catalogue[] | null {
  const fromSettings = tryExtractCataloguesArray(
    row.cataloguesDefinitionUserSettings ?? row.catalogues_definition_user_settings
  );
  if (fromSettings && fromSettings.length > 0) return fromSettings;
  const fromManaged = tryExtractCataloguesArray(
    row.cataloguesDefinitionManaged ?? row.catalogues_definition_managed
  );
  if (fromManaged && fromManaged.length > 0) return fromManaged;
  return null;
}

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

  /** `products.position` (int8) must win over any `position` inside `p.data`. */
  const rowPositionRaw = raw.position ?? raw.table_position;
  const position =
    tryCoerceProductTablePosition(rowPositionRaw) ??
    tryCoerceProductTablePosition(merged.position ?? merged.table_position);

  return {
    ...base,
    id,
    catalogueData: catalogueData ?? base.catalogueData,
    imageUrl: imageUrlRaw || base.imageUrl,
    category,
    ...(position !== undefined ? { position } : {}),
  };
}

/** Parse `products.position` (int8 / bigint / string) for sorting. */
function tryCoerceProductTablePosition(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Match `public.products.position` (drag / sync order). Call after normalizing store RPC rows.
 * Products without `position` sort last, then by `created_at`.
 */
export function sortProductsBySupabaseRowOrder(products: ProductWithCatalogueData[]): ProductWithCatalogueData[] {
  const pos = (p: ProductWithCatalogueData): number => {
    const n = tryCoerceProductTablePosition((p as Record<string, unknown>).position);
    return n ?? Number.MAX_SAFE_INTEGER;
  };
  const created = (p: ProductWithCatalogueData): number => {
    const r = p as Record<string, unknown>;
    const t = r.created_at ?? r.createdAt;
    if (typeof t === 'string') {
      const ms = Date.parse(t);
      return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
  };
  return [...products].sort((a, b) => {
    const d = pos(a) - pos(b);
    if (d !== 0) return d;
    return created(a) - created(b);
  });
}

export interface Store {
  id: string;
  sellerUserId: string;
  storeSlug: string;
  catalogueId: string;
  createdAt: string;
  updatedAt?: string;
  /** When false, public storefront is hidden (persisted as `stores.is_live`). */
  isLive: boolean;
  /** Optional WhatsApp for public storefront (persisted as `stores.store_whatsapp`). */
  storeWhatsapp: string | null;
  /** Optional minimum order total required to place orders on storefront. */
  minimumOrderValue: number | null;
  /** Product listing layout on public storefront. */
  viewMode: 'grid' | 'list';
  /** Whether the homepage is enabled and visible to customers (persisted as `stores.homepage_enabled`). */
  homepageEnabled: boolean;
  /** Whether full website-mode runtime is enabled on storefront. */
  websiteModeEnabled: boolean;
}

export interface StorePublic {
  id: string;
  storeId: string;
  sellerUserId: string;
  storeSlug: string;
  catalogueId: string;
  sellerCurrencyCode: string;
  sellerLogoUrl: string;
  createdAt: string;
  /** From `user_settings.data.businessProfile` via `get_store_by_slug` (public). */
  sellerBusinessName?: string | null;
  sellerAbout?: string | null;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  sellerWebsite?: string | null;
  sellerAddress?: string | null;
  sellerDescription?: string | null;
  /** Optional extras if RPC or client merge supplies them */
  tagline?: string | null;
  phone?: string | null;
  location?: string | null;
  whatsapp?: string | null;
  /** Same as whatsapp when loaded from `stores.store_whatsapp`. */
  storeWhatsapp?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  website?: string | null;
  minimumOrderValue?: number | null;
  /** Product listing layout on public storefront. */
  viewMode?: 'grid' | 'list';
  /** False = seller paused the storefront (from `get_store_by_slug`). */
  isLive?: boolean;
  /** Whether the custom homepage is enabled and visible to customers. */
  homepageEnabled?: boolean;
  /** Whether website-mode runtime should be used by storefront. */
  websiteModeEnabled?: boolean;
  cataloguesDefinition?: Array<{ id: string; label: string; priceField: string; priceUnitField: string; stockField: string; folder: string; order: number; createdAt: number; isDefault?: boolean }>;
}

function normalizeOptionalNonNegativeNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function coerceOptionalBoolean(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (t === 'true' || t === '1') return true;
    if (t === 'false' || t === '0') return false;
  }
  return null;
}

function mapStoreRow(row: Record<string, unknown>): Store {
  const wa = row.store_whatsapp;
  const minimumOrderValue = normalizeOptionalNonNegativeNumber(
    row.minimum_order_value ?? row.minimumOrderValue
  );
  const rawViewMode = row.view_mode ?? row.viewMode;
  const viewMode: 'grid' | 'list' = rawViewMode === 'list' ? 'list' : 'grid';
  return {
    id: String(row.id ?? ''),
    sellerUserId: String(row.seller_user_id ?? ''),
    storeSlug: String(row.store_slug ?? ''),
    catalogueId: String(row.catalogue_id ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
    isLive: row.is_live !== false,
    storeWhatsapp: typeof wa === 'string' && wa.trim() !== '' ? wa.trim() : null,
    minimumOrderValue,
    viewMode,
    homepageEnabled: row.homepage_enabled !== false,
    websiteModeEnabled: row.website_mode_enabled === true,
  };
}

/** Trim; empty → null. If non-empty, require enough digits for wa.me (country + number). */
export function normalizeStoreWhatsappInput(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  const digits = t.replace(/\D/g, '');
  if (digits.length < 8) {
    return { ok: false, error: 'Use a full number with country code (at least 8 digits).' };
  }
  if (digits.length > 15) {
    return { ok: false, error: 'Number looks too long. Check and try again.' };
  }
  return { ok: true, value: t };
}

/** Trim; empty/0 => null. Must be a non-negative numeric amount. */
export function normalizeStoreMinimumOrderValueInput(
  raw: string
): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  const cleaned = t.replace(/,/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Enter a valid amount (numbers only).' };
  }
  if (n < 0) {
    return { ok: false, error: 'Minimum order cannot be negative.' };
  }
  if (n === 0) return { ok: true, value: null };
  return { ok: true, value: Number(n.toFixed(2)) };
}

/**
 * Validate a store slug
 * - Alphanumeric + hyphens only
 * - 3-50 characters
 * - Not reserved word
 */
export function validateStoreSlug(slug: string): { valid: boolean; error?: string } {
  const trimmed = slug.trim().toLowerCase();
  
  if (!trimmed) {
    return { valid: false, error: 'Enter a name for the last part of your store link' };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: 'Use at least 3 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Use at most 50 characters' };
  }

  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return { valid: false, error: 'Use only lowercase letters, numbers, and hyphens (no spaces)' };
  }

  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return { valid: false, error: 'Cannot start or end with a hyphen' };
  }

  if (trimmed.includes('--')) {
    return { valid: false, error: 'Cannot use two hyphens in a row' };
  }

  if (RESERVED_STORE_SLUGS.includes(trimmed)) {
    return { valid: false, error: 'That name is reserved. Please choose a different one' };
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
        is_live: true,
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
          error: `That store link name ("${normalizedSlug}") is already taken. Try one of these:`,
          suggestedSlugs: suggestions,
        };
      }
      
      return { success: false, error: error.message };
    }
    
    console.log('✅ Store created:', data);
    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
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

    let parsed: unknown = data;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        /* keep string; row access will fail gracefully */
      }
    }
    const row = parsed as Record<string, unknown>;
    let businessProfile =
      asRecord(row.businessProfile) ??
      asRecord(row.business_profile) ??
      asRecord(row.seller_business_profile);

    const sellerUserId =
      firstNonEmptyString(row.sellerUserId, row.seller_user_id) ?? '';

    const missingSocialsInRpc =
      !firstNonEmptyString(
        row.instagram,
        row.sellerInstagram,
        row.seller_instagram,
        businessProfile?.instagram,
      ) ||
      !firstNonEmptyString(
        row.twitter,
        row.sellerTwitter,
        row.seller_twitter,
        businessProfile?.twitter,
      ) ||
      !firstNonEmptyString(
        row.facebook,
        row.sellerFacebook,
        row.seller_facebook,
        businessProfile?.facebook,
      );

    if (!businessProfile || missingSocialsInRpc) {
      try {
        const { data: userSettingsRow } = await client
          .from('user_settings')
          .select('data')
          .eq('user_id', sellerUserId)
          .maybeSingle();
        const profileFromSettings = asRecord(
          asRecord((userSettingsRow as Record<string, unknown> | null)?.data)?.businessProfile
        );
        if (profileFromSettings) {
          businessProfile = { ...(businessProfile ?? {}), ...profileFromSettings };
        }
      } catch {
        /* ignore; keep RPC-provided data only */
      }
    }

    let waRaw = row.whatsapp ?? row.store_whatsapp ?? row.storeWhatsapp;
    let whatsapp: string | undefined =
      typeof waRaw === 'string' && waRaw.trim() !== '' ? waRaw.trim() : undefined;
    let minimumOrderValue = normalizeOptionalNonNegativeNumber(
      row.minimumOrderValue ?? row.minimum_order_value ?? row.store_minimum_order_value
    );
    let viewMode: 'grid' | 'list' | null =
      (row.view_mode === 'list' || row.viewMode === 'list')
        ? 'list'
        : (row.view_mode === 'grid' || row.viewMode === 'grid')
          ? 'grid'
          : null;
    let homepageEnabled = coerceOptionalBoolean(row.homepageEnabled ?? row.homepage_enabled);
    let websiteModeEnabled = coerceOptionalBoolean(row.websiteModeEnabled ?? row.website_mode_enabled);

    /* RPC may be older than `stores.store_whatsapp`; public RLS often allows read by slug. */
    if (!whatsapp || minimumOrderValue == null || viewMode == null || homepageEnabled == null || websiteModeEnabled == null) {
      const { data: storeRow } = await client
        .from('stores')
        .select('*')
        .eq('store_slug', normalizedSlug)
        .maybeSingle();
      const storeRecord = storeRow as Record<string, unknown> | null;
      const col = storeRecord?.store_whatsapp;
      if (typeof col === 'string' && col.trim() !== '') {
        whatsapp = col.trim();
      }
      if (minimumOrderValue == null) {
        minimumOrderValue = normalizeOptionalNonNegativeNumber(
          storeRecord?.minimum_order_value ?? storeRecord?.minimumOrderValue
        );
      }
      if (viewMode == null) {
        viewMode =
          storeRecord?.view_mode === 'list' || storeRecord?.viewMode === 'list'
            ? 'list'
            : 'grid';
      }
      if (homepageEnabled == null) {
        homepageEnabled = coerceOptionalBoolean(
          storeRecord?.homepage_enabled ?? storeRecord?.homepageEnabled
        );
      }
      if (websiteModeEnabled == null) {
        websiteModeEnabled = coerceOptionalBoolean(
          storeRecord?.website_mode_enabled ?? storeRecord?.websiteModeEnabled
        );
      }
    }

    const normalized: StorePublic = {
      ...(parsed as StorePublic),
      id: firstNonEmptyString(row.id, row.storeId) ?? '',
      isLive: typeof row.isLive === 'boolean' ? row.isLive : row.is_live !== false,
      homepageEnabled: homepageEnabled ?? true,
      websiteModeEnabled: websiteModeEnabled ?? false,
      sellerWebsite: firstNonEmptyString(
        row.sellerWebsite,
        row.seller_website,
        businessProfile?.website,
      ) ?? null,
      sellerAbout: firstNonEmptyString(
        row.sellerAbout,
        row.seller_about,
        businessProfile?.about,
      ) ?? null,
      sellerPhone: firstNonEmptyString(
        row.sellerPhone,
        row.seller_phone,
        businessProfile?.phone,
      ) ?? null,
      sellerEmail: firstNonEmptyString(
        row.sellerEmail,
        row.seller_email,
        businessProfile?.email,
      ) ?? null,
      sellerAddress: firstNonEmptyString(
        row.sellerAddress,
        row.seller_address,
        businessProfile?.address,
      ) ?? null,
      sellerDescription: firstNonEmptyString(
        row.sellerDescription,
        row.seller_description,
        businessProfile?.description,
      ) ?? null,
      instagram: firstNonEmptyString(
        row.instagram,
        row.sellerInstagram,
        row.seller_instagram,
        businessProfile?.instagram,
      ) ?? null,
      twitter: firstNonEmptyString(
        row.twitter,
        row.sellerTwitter,
        row.seller_twitter,
        businessProfile?.twitter,
      ) ?? null,
      facebook: firstNonEmptyString(
        row.facebook,
        row.sellerFacebook,
        row.seller_facebook,
        businessProfile?.facebook,
      ) ?? null,
      website: firstNonEmptyString(
        row.website,
        row.publicWebsite,
        row.public_website,
        row.sellerWebsite,
        row.seller_website,
        businessProfile?.website,
      ) ?? null,
      minimumOrderValue: minimumOrderValue ?? null,
      viewMode: viewMode ?? 'grid',
    };
    if (whatsapp) {
      normalized.whatsapp = whatsapp;
      normalized.storeWhatsapp = whatsapp;
    }

    const storeCatId = String(
      normalized.catalogueId ??
        (row as Record<string, unknown>).catalogue_id ??
        (row as Record<string, unknown>).catalogueId ??
        ''
    ).trim();

    // Catalogue definitions: prefer RPC payload (`get_store_by_slug` security definer); anon RLS blocks direct `user_settings` / `catalogues_definition`.
    let list: Catalogue[] | null = extractCataloguesListFromStoreRpcPayload(row);
    if (debugStorefrontCatalogue) {
      console.warn('[getStoreBySlug] catalogues from RPC:', list?.length ?? 0, 'sellerUserId:', sellerUserId);
    }

    if (!list || list.length === 0) {
      try {
        const { data: catSettingsRow } = await client
          .from('user_settings')
          .select('data')
          .eq('user_id', sellerUserId)
          .maybeSingle();
        const rawUserData = (catSettingsRow as Record<string, unknown> | null)?.data;
        const settingsData = parseUserSettingsDataColumn(rawUserData);

        if (debugStorefrontCatalogue) {
          console.warn('[getStoreBySlug] raw catSettingsRow:', catSettingsRow);
          console.warn('[getStoreBySlug] settingsData (parsed):', settingsData);
          console.warn('[getStoreBySlug] cataloguesDefinition raw:', settingsData?.cataloguesDefinition);
        }

        list = tryExtractCataloguesArray(settingsData?.cataloguesDefinition);
        if (!list || list.length === 0) {
          const { data: catDefRow, error: catDefErr } = await client
            .from('catalogues_definition')
            .select('data')
            .eq('user_id', sellerUserId)
            .maybeSingle();
          if (!catDefErr && catDefRow && catDefRow.data != null) {
            list = tryExtractCataloguesArray(parseJsonbValue(catDefRow.data)) ?? null;
            if (debugStorefrontCatalogue) {
              console.warn('[getStoreBySlug] catalogues_definition fallback:', catDefRow, 'extracted:', list?.length);
            }
          }
        }
      } catch {
        list = null;
      }
    }

    try {
      normalized.cataloguesDefinition = ensureCataloguesForStorefront(
        list ?? undefined,
        storeCatId || undefined
      );
    } catch {
      try {
        normalized.cataloguesDefinition = ensureCataloguesForStorefront(undefined, storeCatId || undefined);
      } catch {
        /* ignore */
      }
    }

    return { success: true, data: normalized };
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
      data: mapStoreRow(store as Record<string, unknown>),
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
          error: `That store link name ("${normalizedSlug}") is already taken. Try one of these:`,
          suggestedSlugs: suggestions,
        };
      }
      
      return { success: false, error: error.message };
    }
    
    console.log('✅ Store slug updated:', data);
    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
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
      data: mapStoreRow(data as Record<string, unknown>),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreCatalogue:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

export async function updateStoreViewMode(
  sellerUserId: string,
  viewMode: 'grid' | 'list'
): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();
    setSupabaseRlsUserId(sellerUserId);

    const { data, error } = await client
      .from('stores')
      .update({
        view_mode: viewMode,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating store view mode:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreViewMode:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

/**
 * Toggle whether the public storefront is visible (persisted in `stores.is_live`).
 */
/**
 * Set or clear the WhatsApp number shown on the public storefront (floating button + chip).
 * Pass null or empty after normalization to remove.
 */
export async function updateStoreWhatsapp(
  sellerUserId: string,
  storeWhatsapp: string | null
): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();
    setSupabaseRlsUserId(sellerUserId);

    const { data, error } = await client
      .from('stores')
      .update({
        store_whatsapp: storeWhatsapp,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating store WhatsApp:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreWhatsapp:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

export async function updateStoreMinimumOrderValue(
  sellerUserId: string,
  minimumOrderValue: number | null
): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();
    setSupabaseRlsUserId(sellerUserId);

    const { data, error } = await client
      .from('stores')
      .update({
        minimum_order_value: minimumOrderValue,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating store minimum order value:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreMinimumOrderValue:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

export async function updateStoreLiveStatus(
  sellerUserId: string,
  isLive: boolean
): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();
    setSupabaseRlsUserId(sellerUserId);

    const { data, error } = await client
      .from('stores')
      .update({
        is_live: isLive,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating store live status:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in updateStoreLiveStatus:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

/** Custom website on/off — keeps homepage + full website storefront in sync. */
export async function updateStoreWebsiteStatus(
  sellerUserId: string,
  enabled: boolean
): Promise<{ success: boolean; data?: Store; error?: string }> {
  try {
    const client = getSupabaseClient();
    setSupabaseRlsUserId(sellerUserId);

    const { data, error } = await client
      .from('stores')
      .update({
        website_mode_enabled: enabled,
        homepage_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select()
      .single();

    if (error) {
      const errorMsg = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : String(error);
      console.error('❌ Error updating store website status:', errorMsg, error);
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      data: mapStoreRow(data as Record<string, unknown>),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Exception in updateStoreWebsiteStatus:', errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    setSupabaseRlsUserId(null);
  }
}

export async function updateStoreWebsiteModeStatus(
  sellerUserId: string,
  websiteModeEnabled: boolean
): Promise<{ success: boolean; data?: Store; error?: string }> {
  return updateStoreWebsiteStatus(sellerUserId, websiteModeEnabled);
}

/** @deprecated Use updateStoreWebsiteStatus — toggles homepage and website mode together. */
export async function updateStoreHomepageStatus(
  sellerUserId: string,
  homepageEnabled: boolean
): Promise<{ success: boolean; data?: Store; error?: string }> {
  return updateStoreWebsiteStatus(sellerUserId, homepageEnabled);
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
 * @param cataloguesForReconcile — seller's catalogues (from `getStoreBySlug`); merges top-level price fields into `catalogueData` for correct guest pricing
 */
export async function getStoreProducts(
  sellerUserId: string,
  cataloguesForReconcile?: Catalogue[]
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
    const catList =
      Array.isArray(cataloguesForReconcile) && cataloguesForReconcile.length > 0
        ? cataloguesForReconcile
        : DEFAULT_CATALOGUES;
    const products = sortProductsBySupabaseRowOrder(
      list
        .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object' && !Array.isArray(x))
        .map((row) =>
          syncTopLevelFieldsIntoCatalogueData(normalizePublicStoreProduct(row), catList)
        )
    );

    return { success: true, products };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Exception in getStoreProducts:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
