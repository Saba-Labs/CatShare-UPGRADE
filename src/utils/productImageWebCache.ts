/**
 * Web-only: persist fetched product source images in IndexedDB so canvas/PDF
 * can use data URLs without relying on CORS for every draw (and without Capacitor Filesystem).
 */

const DB_NAME = 'catshare-product-images-v1';
const STORE = 'images';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function cacheKey(userId: string, productId: string): string {
  return `${userId}::${productId}`;
}

export async function webCachePut(userId: string, productId: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  const key = cacheKey(userId, String(productId));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(dataUrl, key);
  });
}

export async function webCacheGet(userId: string, productId: string): Promise<string | null> {
  try {
    const db = await openDb();
    const key = cacheKey(userId, String(productId));
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === 'string' && v.length > 0 ? v : null);
      };
    });
  } catch {
    return null;
  }
}
