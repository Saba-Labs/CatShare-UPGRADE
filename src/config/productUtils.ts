/**
 * Product Utility Functions
 * 
 * High-level API for working with products that abstracts away the
 * complexity of field migration and dual naming schemes.
 * 
 * Components can use these functions instead of directly accessing
 * product properties, ensuring backward compatibility automatically.
 */

import {
  getProductFieldValue,
  getProductUnitValue,
  syncProductFieldNames,
  migrateProductToNewFormat,
} from './fieldMigration';
import { getFieldsDefinition, getFieldConfig, FieldConfig } from './fieldConfig';
import { getPersistedAuthUserId } from '../utils/authUserId';
import { getStorageKey } from '../utils/safeStorage';
import {
  syncTopLevelFieldsIntoCatalogueData,
  type ProductWithCatalogueData,
} from './catalogueProductUtils';
import { getAllCatalogues } from './catalogueConfig';
import { normalizeProductImageFields } from '../utils/productImages';

/**
 * Product interface that works with both old and new field names
 */
export interface Product {
  id: string;
  name: string;
  subtitle?: string;
  category?: string[];
  badge?: string;
  
  // These work with both old names (color, package, age) and new names (field1, field2, field3)
  [key: string]: any;
}

/**
 * Get a product field value, automatically handling legacy field names
 * 
 * @param product The product object
 * @param fieldKeyOrLegacy The field key (field1, field2, field3) or legacy name (color, package, age)
 * @returns The field value
 * 
 * @example
 * getFieldValue(product, 'field1') // returns product.field1 or product.color
 * getFieldValue(product, 'color') // returns product.color or product.field1
 */
export function getFieldValue(product: Product, fieldKeyOrLegacy: string): any {
  if (!product) return undefined;

  // Try the direct key first (works for both new keys like 'field1' and any custom key)
  if (fieldKeyOrLegacy in product) {
    return product[fieldKeyOrLegacy];
  }

  // If it looks like a legacy key, try to map it to new key
  const mappedKey = mapFieldKey(fieldKeyOrLegacy);
  if (mappedKey && mappedKey !== fieldKeyOrLegacy) {
    return getFieldValue(product, mappedKey);
  }

  return undefined;
}

/**
 * Get a unit value for a field, automatically handling legacy unit names
 * 
 * @param product The product object
 * @param fieldKeyOrLegacy The field key (field1, field2, field3) or legacy name (color, package, age)
 * @returns The unit value or default unit
 * 
 * @example
 * getUnitValue(product, 'field2') // returns product.field2Unit or product.packageUnit
 */
export function getUnitValue(product: Product, fieldKeyOrLegacy: string): string | undefined {
  if (!product) return undefined;

  const mappedKey = mapFieldKey(fieldKeyOrLegacy);
  const fieldConfig = getFieldConfig(mappedKey || fieldKeyOrLegacy);

  if (!fieldConfig?.unitField) return undefined;

  // Try new unit key
  if (fieldConfig.unitField in product) {
    return product[fieldConfig.unitField];
  }

  // Try legacy unit key
  if (fieldConfig.legacyKeys?.[0]) {
    const legacyUnitKey = fieldConfig.legacyKeys[0] + 'Unit';
    if (legacyUnitKey in product) {
      return product[legacyUnitKey];
    }
  }

  return fieldConfig.defaultUnit;
}

/**
 * Set a field value, automatically setting both new and legacy field names
 * This ensures backward compatibility for code still using legacy names
 * 
 * @param product The product object (mutated)
 * @param fieldKeyOrLegacy The field key or legacy name
 * @param value The new value
 * @returns The updated product
 * 
 * @example
 * setFieldValue(product, 'field1', 'Red') // sets field1 and color
 */
export function setFieldValue(
  product: Product,
  fieldKeyOrLegacy: string,
  value: any
): Product {
  const mappedKey = mapFieldKey(fieldKeyOrLegacy);
  const finalKey = mappedKey || fieldKeyOrLegacy;

  product[finalKey] = value;

  // Also set legacy names if applicable
  const fieldConfig = getFieldConfig(finalKey);
  if (fieldConfig?.legacyKeys) {
    for (const legacyKey of fieldConfig.legacyKeys) {
      product[legacyKey] = value;
    }
  }

  return product;
}

/**
 * Set a unit value, automatically setting both new and legacy unit names
 * 
 * @param product The product object (mutated)
 * @param fieldKeyOrLegacy The field key or legacy name
 * @param unit The new unit value
 * @returns The updated product
 * 
 * @example
 * setUnitValue(product, 'field2', 'pcs / dozen') // sets field2Unit and packageUnit
 */
export function setUnitValue(
  product: Product,
  fieldKeyOrLegacy: string,
  unit: string
): Product {
  const mappedKey = mapFieldKey(fieldKeyOrLegacy);
  const finalKey = mappedKey || fieldKeyOrLegacy;
  const fieldConfig = getFieldConfig(finalKey);

  if (!fieldConfig?.unitField) return product;

  product[fieldConfig.unitField] = unit;

  // Also set legacy unit names if applicable
  if (fieldConfig.legacyKeys?.[0]) {
    const legacyUnitKey = fieldConfig.legacyKeys[0] + 'Unit';
    product[legacyUnitKey] = unit;
  }

  return product;
}

/**
 * Map a field key or legacy name to the canonical new field key
 * 
 * @example
 * mapFieldKey('color') // returns 'field1'
 * mapFieldKey('field1') // returns 'field1'
 * mapFieldKey('unknown') // returns undefined
 */
export function mapFieldKey(keyOrLegacy: string): string | undefined {
  // If it's already a new field key, return as-is
  if (keyOrLegacy.match(/^field\d+$/)) {
    return keyOrLegacy;
  }

  // Try to find a field config with this as a legacy key
  const definition = getFieldsDefinition();
  for (const field of definition.fields) {
    if (field.legacyKeys?.includes(keyOrLegacy)) {
      return field.key;
    }
  }

  return undefined;
}

/**
 * Get the display label for a field
 * 
 * @param fieldKeyOrLegacy The field key or legacy name
 * @returns The display label (e.g., "Colour", "Package", "Age Group")
 */
export function getFieldLabel(fieldKeyOrLegacy: string): string | undefined {
  const mappedKey = mapFieldKey(fieldKeyOrLegacy);
  const fieldConfig = getFieldConfig(mappedKey || fieldKeyOrLegacy);
  return fieldConfig?.label;
}

/**
 * Get all field configurations
 */
export function getAllFieldConfigs(): FieldConfig[] {
  return getFieldsDefinition().fields;
}

/**
 * Get all configured fields that should be displayed as custom fields
 * (typically field1, field2, field3)
 */
export function getCustomFields(): FieldConfig[] {
  return getFieldsDefinition().fields.filter(f => f.key.match(/^field\d+$/));
}

/**
 * Ensure a product has both new and legacy field names
 * Use this before saving a product to localStorage
 */
export function normalizeProduct(product: Product): Product {
  const migrated = migrateProductToNewFormat(product);
  const synced = syncProductFieldNames(migrated);
  return synced as Product;
}

/** After field migration, only when persisting — avoids running on every read/bootstrap. */
function withCatalogueTopLevelSync(product: Product): Product {
  const base = normalizeProduct(product);
  try {
    return syncTopLevelFieldsIntoCatalogueData(
      base as ProductWithCatalogueData,
      getAllCatalogues()
    ) as Product;
  } catch (e) {
    console.warn('[CatShare] catalogue top-level sync skipped:', e);
    return base;
  }
}

/**
 * Get a product with all fields accessible via both old and new names
 * Use this when loading a product from localStorage
 */
export function prepareProduct(product: Product): Product {
  return normalizeProductImageFields(normalizeProduct(product) as Record<string, unknown>) as Product;
}

/**
 * Read all products from localStorage and ensure they're normalized
 * @param userId - Optional user ID for keyed storage. If not provided, tries localStorage fallback
 */
export function getAllProducts(userId?: string): Product[] {
  try {
    // Determine which storage key to use
    let storageKey = 'products';
    if (userId) {
      storageKey = getStorageKey('products', userId);
    } else {
      // Try to get userId from localStorage as fallback
      const authUserId = getPersistedAuthUserId();
      if (authUserId) {
        storageKey = getStorageKey('products', authUserId);
      }
    }

    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const products = JSON.parse(stored);
    return Array.isArray(products) ? products.map(prepareProduct) : [];
  } catch (err) {
    console.error('Failed to load products:', err);
    return [];
  }
}

/**
 * Save a product to localStorage, ensuring it's normalized
 * @param product - Product to save
 * @param userId - Optional user ID for keyed storage
 */
export function saveProduct(product: Product, userId?: string): void {
  const all = getAllProducts(userId);
  const normalized = withCatalogueTopLevelSync(product);
  const updated = product.id
    ? all.map(p => (p.id === product.id ? normalized : p))
    : [...all, normalized];

  try {
    const effectiveUserId = userId || getPersistedAuthUserId() || '';
    const storageKey = effectiveUserId ? getStorageKey('products', effectiveUserId) : 'products';
    localStorage.setItem(storageKey, JSON.stringify(updated));
    // Trigger Supabase sync
    triggerSupabaseSync(updated, effectiveUserId);
  } catch (err) {
    console.error('Failed to save product:', err);
  }
}

/**
 * Save multiple products to localStorage
 * @param products - Products to save
 * @param userId - Optional user ID for keyed storage
 */
export function saveProducts(products: Product[], userId?: string): void {
  try {
    const normalized = products.map((p) => {
      // Snapshot catalogueData BEFORE normalizeProduct can touch it
      const catalogueDataSnapshot = p.catalogueData
        ? JSON.parse(JSON.stringify(p.catalogueData))
        : null;
      const preservedUpdatedAt = p.updatedAt;

      const n = normalizeProduct(p);

      // Restore full catalogueData from snapshot, overriding whatever normalizeProduct did
      if (catalogueDataSnapshot) {
        n.catalogueData = catalogueDataSnapshot;
      }
      if (preservedUpdatedAt) {
        n.updatedAt = preservedUpdatedAt;
      }

      return n;
    });
    const effectiveUserId = userId || getPersistedAuthUserId() || '';
    const storageKey = effectiveUserId ? getStorageKey('products', effectiveUserId) : 'products';
    localStorage.setItem(storageKey, JSON.stringify(normalized));
    // Trigger Supabase sync
    triggerSupabaseSync(normalized, effectiveUserId);
  } catch (err) {
    console.error('Failed to save products:', err);
  }
}

/**
 * Trigger Supabase sync for products
 * @param products - Products to sync
 * @param userId - User ID for sync (optional, will try localStorage fallback if not provided)
 */
function triggerSupabaseSync(products: Product[], userId?: string): void {
  try {
    // In strict mode, sync is handled centrally by the product-added event in App.tsx.
    if (localStorage.getItem('strictOnlineMode::device') === 'true') return;

    const effectiveUserId = userId || getPersistedAuthUserId();
    if (!effectiveUserId) {
      console.warn('⚠️ No authenticated user id found. Skipping Supabase sync.');
      return;
    }

    import('../services/supabaseSync').then(({ syncProducts }) => {
      syncProducts(effectiveUserId, products)
        .then(result => {
          if (result.success) console.log('✅ Products synced to Supabase');
          else console.warn('⚠️ Supabase sync failed:', result.error);
        })
        .catch(err => {
          console.error('❌ Failed to sync products to Supabase:', err);
        });
    }).catch(importErr => {
      console.error('❌ Failed to import syncProducts:', importErr);
    });
  } catch (err) {
    console.error('❌ Exception in triggerSupabaseSync:', err);
  }
}
