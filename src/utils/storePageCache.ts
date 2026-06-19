import type { CustomDomainState } from '../services/storeCustomDomainApi';
import type { Store } from '../services/storeService';
import type { Order } from '../services/orderService';
import type { StoreBehaviorSettings } from '../types/storeBehaviorSettings';
import type { StoreMarketingSettings } from '../types/storeMarketingSettings';
import type { StoreSecuritySettings } from '../types/storeSecuritySettings';
import type { ShippingPreferences } from '../integrations/core/types';
import { getStorageKey, safeGetFromStorage, safeSetInStorage } from './safeStorage';

export const sellerStoreCacheKey = (uid: string) => getStorageKey('sellerStore', uid);
export const sellerOrdersCacheKey = (uid: string) => getStorageKey('sellerOrders', uid);
export const storeBehaviorSettingsCacheKey = (uid: string) =>
  getStorageKey('storeBehaviorSettings', uid);
export const storeMarketingSettingsCacheKey = (uid: string) =>
  getStorageKey('storeMarketingSettings', uid);
export const storeSecuritySettingsCacheKey = (uid: string) =>
  getStorageKey('storeSecuritySettings', uid);
export const storeShippingPreferencesCacheKey = (uid: string) =>
  getStorageKey('storeShippingPreferences', uid);
export const customDomainStateCacheKey = (uid: string) =>
  getStorageKey('customDomainState', uid);

export function readCachedSellerStore(uid: string): Store | null {
  return safeGetFromStorage<Store | null>(sellerStoreCacheKey(uid), null);
}

export function writeCachedSellerStore(uid: string, store: Store): void {
  safeSetInStorage(sellerStoreCacheKey(uid), store);
}

export function readCachedSellerOrders(uid: string): Order[] {
  const parsed = safeGetFromStorage<Order[]>(sellerOrdersCacheKey(uid), []);
  return Array.isArray(parsed) ? parsed : [];
}

export function writeCachedSellerOrders(uid: string, orders: Order[]): void {
  safeSetInStorage(sellerOrdersCacheKey(uid), orders);
}

export function readCachedOrderById(uid: string, orderId: string): Order | null {
  if (!orderId) return null;
  return readCachedSellerOrders(uid).find((o) => o.id === orderId) ?? null;
}

export function upsertCachedOrder(uid: string, order: Order): void {
  const orders = readCachedSellerOrders(uid);
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    const next = [...orders];
    next[idx] = order;
    writeCachedSellerOrders(uid, next);
    return;
  }
  writeCachedSellerOrders(uid, [order, ...orders]);
}

export function patchCachedOrder(
  uid: string,
  orderId: string,
  patch: Partial<Order>
): void {
  const orders = readCachedSellerOrders(uid);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  const next = [...orders];
  next[idx] = { ...next[idx], ...patch };
  writeCachedSellerOrders(uid, next);
}

export function removeCachedOrder(uid: string, orderId: string): void {
  writeCachedSellerOrders(
    uid,
    readCachedSellerOrders(uid).filter((o) => o.id !== orderId)
  );
}

export function readCachedBehaviorSettings(uid: string): StoreBehaviorSettings | null {
  return safeGetFromStorage<StoreBehaviorSettings | null>(
    storeBehaviorSettingsCacheKey(uid),
    null
  );
}

export function writeCachedBehaviorSettings(uid: string, settings: StoreBehaviorSettings): void {
  safeSetInStorage(storeBehaviorSettingsCacheKey(uid), settings);
}

export function readCachedMarketingSettings(uid: string): StoreMarketingSettings | null {
  return safeGetFromStorage<StoreMarketingSettings | null>(
    storeMarketingSettingsCacheKey(uid),
    null
  );
}

export function writeCachedMarketingSettings(uid: string, settings: StoreMarketingSettings): void {
  safeSetInStorage(storeMarketingSettingsCacheKey(uid), settings);
}

export function readCachedSecuritySettings(uid: string): StoreSecuritySettings | null {
  return safeGetFromStorage<StoreSecuritySettings | null>(
    storeSecuritySettingsCacheKey(uid),
    null
  );
}

export function writeCachedSecuritySettings(uid: string, settings: StoreSecuritySettings): void {
  safeSetInStorage(storeSecuritySettingsCacheKey(uid), settings);
}

export function readCachedShippingPreferences(uid: string): ShippingPreferences | null {
  return safeGetFromStorage<ShippingPreferences | null>(
    storeShippingPreferencesCacheKey(uid),
    null
  );
}

export function writeCachedShippingPreferences(uid: string, prefs: ShippingPreferences): void {
  safeSetInStorage(storeShippingPreferencesCacheKey(uid), prefs);
}

export function readCachedCustomDomainState(uid: string): CustomDomainState | null {
  return safeGetFromStorage<CustomDomainState | null>(customDomainStateCacheKey(uid), null);
}

export function writeCachedCustomDomainState(uid: string, state: CustomDomainState): void {
  safeSetInStorage(customDomainStateCacheKey(uid), state);
}

/** Clear all store-page caches for a seller (e.g. after store deletion). */
export function clearStorePageCaches(uid: string): void {
  const keys = [
    sellerStoreCacheKey,
    sellerOrdersCacheKey,
    storeBehaviorSettingsCacheKey,
    storeMarketingSettingsCacheKey,
    storeSecuritySettingsCacheKey,
    storeShippingPreferencesCacheKey,
    customDomainStateCacheKey,
  ];
  for (const keyFn of keys) {
    try {
      localStorage.removeItem(keyFn(uid));
    } catch {
      /* ignore */
    }
  }
}
