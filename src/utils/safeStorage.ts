/**
 * Safe JSON parsing utility for localStorage
 * Prevents app crashes from corrupted or invalid JSON data
 */

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
 * Generate a per-user image path for Filesystem storage
 * @param productId - Product ID
 * @param userId - User ID (optional, will use localStorage fallback if not provided)
 * @returns File path (e.g., "user-uid123/catalogue/product-xyz.png")
 */
export function getUserImagePath(
  productId: string,
  userId?: string,
  catalogueFolder: string = 'catalogue'
): string {
  const effectiveUserId = userId || localStorage.getItem('firebaseUserId') || 'anonymous';
  // Expected on-disk layout (user-scoped, simple):
  //   user-<uid>/<catalogue-folder>/product-<id>.png
  return `user-${effectiveUserId}/${catalogueFolder}/product-${productId}.png`;
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
      console.warn(`⚠️ Storage quota exceeded for key "${key}". Data not saved. Clear some data to continue.`);
    } else {
      console.error(`❌ Error writing to localStorage key "${key}":`, error);
    }
    return false;
  }
}
