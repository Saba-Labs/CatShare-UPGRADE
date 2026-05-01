/**
 * Safe JSON parsing utility for localStorage
 * Prevents app crashes from corrupted or invalid JSON data
 */

import { getPersistedAuthUserId } from './authUserId';

/**
 * Generate a per-user storage key
 * @param baseKey - Base key name (e.g., "products", "categories")
 * @param userId - User ID to namespace the key
 * @returns Keyed string (e.g., "products::user123")
 */
export function getStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}::${userId}`;
}

/**
 * Canonical path for the product's **source** photo (one per product, shared across catalogues).
 * @param _catalogueFolder — deprecated; ignored. Kept for call-site compatibility.
 * @returns e.g. "user-<uid>/Products/product-<id>.png"
 */
export function getUserImagePath(
  productId: string,
  userId?: string,
  _catalogueFolder?: string
): string {
  const effectiveUserId = userId || getPersistedAuthUserId() || 'anonymous';
  return `user-${effectiveUserId}/Products/product-${productId}.png`;
}

/**
 * Safely parse JSON from localStorage with fallback
 * @param key - localStorage key to retrieve
 * @param fallback - Default value if parsing fails
 * @returns Parsed value or fallback
 */
export function safeParse<T>(key: string | null, fallback: T): T {
  if (!key) {
    return fallback;
  }

  try {
    return JSON.parse(key) as T;
  } catch (error) {
    // Resilience: If parsing fails but the fallback is a string,
    // we can assume the stored value was intended as a plain string.
    // This handles legacy data stored without JSON.stringify().
    if (typeof fallback === 'string') {
      return key as unknown as T;
    }

    console.warn(`⚠️ Failed to parse JSON from localStorage:`, error);
    return fallback;
  }
}

/**
 * Safely get and parse from localStorage
 * @param key - localStorage key
 * @param fallback - Default value if key doesn't exist or parsing fails
 * @returns Parsed value or fallback
 */
export function safeGetFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return fallback;
    }
    return safeParse(item, fallback);
  } catch (error) {
    console.warn(`⚠️ Error reading from localStorage key "${key}":`, error);
    return fallback;
  }
}

/**
 * Safely set JSON in localStorage
 * @param key - localStorage key
 * @param value - Value to store
 * @returns true if successful, false if failed
 */
export function safeSetInStorage<T>(key: string, value: T): boolean {
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key, json);
    return true;
  } catch (error: any) {
    if (error.name === "QuotaExceededError") {
      const approx = (() => {
        try {
          return JSON.stringify(value).length;
        } catch {
          return 0;
        }
      })();
      console.warn(
        `⚠️ Storage quota exceeded for key "${key}" (~${approx} chars). Data not saved. Clear some data or reduce catalogue size.`
      );
    } else {
      console.error(`❌ Error writing to localStorage key "${key}":`, error);
    }
    return false;
  }
}

/**
 * Remove bulky fields before persisting product rows (avoids QuotaExceededError for large catalogues).
 * Aligns with syncProducts cleanup: keep imageUrl / imagePath; drop huge inline payloads.
 */
export function stripProductRowForLocalStorage(p: any): any {
  if (!p || typeof p !== 'object') return p;
  const o = { ...p } as Record<string, unknown>;
  delete o.imageBase64;
  delete o.imageData;
  delete o.imageFilename;
  delete o.renderedImages;
  delete o.renderedImage;
  const hasCloud =
    typeof o.imageUrl === 'string' && String(o.imageUrl).trim().length > 0;
  const im = o.image;
  if (typeof im === 'string') {
    if (im.startsWith('data:') && (hasCloud || im.length > 48_000)) {
      delete o.image;
    }
  }
  return o;
}

export function stripProductArrayForLocalStorage(arr: unknown): any[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(stripProductRowForLocalStorage);
}

/** Persist keyed active products; strips heavy fields and retries once if quota exceeded. */
export function safeSetProductsCache(userId: string, products: unknown): boolean {
  const u = typeof userId === 'string' ? userId.trim() : '';
  if (!u) return false;
  const key = getStorageKey('products', u);
  const stripped = stripProductArrayForLocalStorage(products);
  if (safeSetInStorage(key, stripped)) return true;
  const minimal = stripped.map((p) => {
    const o = stripProductRowForLocalStorage(p) as Record<string, unknown>;
    delete o.image;
    return o;
  });
  const ok = safeSetInStorage(key, minimal);
  if (!ok) {
    console.warn('[CatShare] Products cache still could not be saved after stripping images. Try clearing old backups or site data.');
  }
  return ok;
}

/** Persist keyed shelf/deleted products; same stripping as active list. */
export function safeSetDeletedProductsCache(userId: string, deleted: unknown): boolean {
  const u = typeof userId === 'string' ? userId.trim() : '';
  if (!u) return false;
  const key = getStorageKey('deletedProducts', u);
  const stripped = stripProductArrayForLocalStorage(deleted);
  if (safeSetInStorage(key, stripped)) return true;
  const minimal = stripped.map((p) => {
    const o = stripProductRowForLocalStorage(p) as Record<string, unknown>;
    delete o.image;
    return o;
  });
  return safeSetInStorage(key, minimal);
}

/** Legacy unkeyed keys (pre–per-user migration). */
const LEGACY_PRODUCTS_LS = 'products';
const LEGACY_DELETED_LS = 'deletedProducts';

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Load products: prefer non-empty `products::<userId>`, then legacy `products` when allowed.
 *
 * Important offline case: keyed row may exist as `[]` after a race or empty write while real data
 * still lives under legacy `products`. When **offline** and keyed is empty, we try legacy.
 * When **online** and keyed exists (including `[]`), we trust keyed so cloud-empty catalogues
 * are not overwritten by stale legacy blobs.
 */
export function readProductsWithLegacyFallback(userId: string): any[] {
  if (!userId || typeof userId !== 'string') return [];

  const k = getStorageKey('products', userId);
  const rawKeyed = localStorage.getItem(k);
  let keyedArr: any[] = [];
  if (rawKeyed !== null) {
    const parsed = safeGetFromStorage(k, [] as any[]);
    keyedArr = Array.isArray(parsed) ? parsed : [];
    if (keyedArr.length > 0) return keyedArr;
  }

  const guest = localStorage.getItem('isOfflineGuest') === 'true';
  const persisted = getPersistedAuthUserId();
  const offline = isBrowserOffline();

  if (guest) {
    const legacy = safeGetFromStorage(LEGACY_PRODUCTS_LS, [] as any[]);
    return Array.isArray(legacy) && legacy.length > 0 ? legacy : keyedArr;
  }

  // Online: different persisted id usually means another account’s keyed data — do not use shared legacy.
  // Offline: the session `userId` is authoritative; a stale `supabase_user_id` must not block legacy fallback
  // (otherwise the Products tab stays empty while `products` or `products::uid` still has rows).
  if (persisted && persisted !== userId && !offline) {
    return keyedArr;
  }

  const tryLegacy = (): any[] => {
    const legacy = safeGetFromStorage(LEGACY_PRODUCTS_LS, [] as any[]);
    return Array.isArray(legacy) && legacy.length > 0 ? legacy : keyedArr;
  };

  if (offline && keyedArr.length === 0) {
    return tryLegacy();
  }

  if (rawKeyed === null && persisted === userId) {
    return tryLegacy();
  }

  // Keyed exists as [] but legacy still has rows: happens when navigator reports "online"
  // while air-gapped, after an empty write race, or when global migration short-circuited.
  // Do not strand the user on Welcome while `products` still holds their list.
  if (
    keyedArr.length === 0 &&
    rawKeyed !== null &&
    (!persisted || persisted === userId)
  ) {
    const legacyFill = tryLegacy();
    if (legacyFill.length > 0) return legacyFill;
  }

  return keyedArr;
}

/**
 * Same semantics as `readProductsWithLegacyFallback` for deleted / shelf rows.
 */
export function readDeletedProductsWithLegacyFallback(userId: string): any[] {
  if (!userId || typeof userId !== 'string') return [];

  const k = getStorageKey('deletedProducts', userId);
  const rawKeyed = localStorage.getItem(k);
  let keyedArr: any[] = [];
  if (rawKeyed !== null) {
    const parsed = safeGetFromStorage(k, [] as any[]);
    keyedArr = Array.isArray(parsed) ? parsed : [];
    if (keyedArr.length > 0) return keyedArr;
  }

  const guest = localStorage.getItem('isOfflineGuest') === 'true';
  const persisted = getPersistedAuthUserId();
  const offline = isBrowserOffline();

  if (guest) {
    const legacy = safeGetFromStorage(LEGACY_DELETED_LS, [] as any[]);
    return Array.isArray(legacy) && legacy.length > 0 ? legacy : keyedArr;
  }

  if (persisted && persisted !== userId && !offline) {
    return keyedArr;
  }

  const tryLegacy = (): any[] => {
    const legacy = safeGetFromStorage(LEGACY_DELETED_LS, [] as any[]);
    return Array.isArray(legacy) && legacy.length > 0 ? legacy : keyedArr;
  };

  if (offline && keyedArr.length === 0) {
    return tryLegacy();
  }

  if (rawKeyed === null && persisted === userId) {
    return tryLegacy();
  }

  if (
    keyedArr.length === 0 &&
    rawKeyed !== null &&
    (!persisted || persisted === userId)
  ) {
    const legacyFill = tryLegacy();
    if (legacyFill.length > 0) return legacyFill;
  }

  return keyedArr;
}
