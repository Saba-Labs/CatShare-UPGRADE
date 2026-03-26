import React, { createContext, useContext, useCallback, useState, useRef, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from '../utils/safeStorage';
import { cacheCloudProductImages } from '../utils/productImageLocalCache';
import { readProductSourceBase64ForCloudUpload } from '../utils/productSourceImage';
import { assertProductsHaveCloudImageUrlForSync } from '../utils/syncImageValidation';
import { getFieldsDefinition, setFieldsDefinition } from '../config/fieldConfig';
import { getCataloguesDefinition, setCataloguesDefinition } from '../config/catalogueConfig';

export type RefreshFromCloudOptions = {
  onStatus?: (message: string) => void;
};

/** When true, updates `syncStatusDetail` during sync (full-screen overlay). Default false — routine saves stay on “Please wait…”. */
export type SyncProductsToCloudOptions = {
  detailedStatus?: boolean;
};

interface SyncContextType {
  isSyncing: boolean;
  syncStatusDetail: string | null;
  /** 0–100 during detailed sync (restore); 0 otherwise */
  syncProgressPercent: number;
  syncError: string | null;
  syncProductsToCloud: (
    products: any[],
    deletedProducts: any[],
    options?: SyncProductsToCloudOptions
  ) => Promise<{ products: any[]; deletedProducts: any[] }>;
  refreshFromCloud: (opts?: RefreshFromCloudOptions) => Promise<{ products: any[]; deletedProducts: any[] } | null>;
  isStrictMode: () => boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const getProductsKey = (uid: string) => getStorageKey('products', uid);
const getDeletedProductsKey = (uid: string) => getStorageKey('deletedProducts', uid);

/** Map status lines from detailed cloud sync to 0–100 for SyncProgressModal (restore, etc.). */
export function computeSyncPercentFromDetail(message: string): number {
  if (!message || !message.trim()) return 0;
  const m = message.trim();
  if (/Preparing sync/i.test(m)) return 3;
  let im = m.match(/Uploading image (\d+)\/(\d+)/);
  if (im) {
    const cur = parseInt(im[1], 10);
    const tot = parseInt(im[2], 10);
    if (tot > 0) return 5 + Math.round((cur / tot) * 32);
  }
  im = m.match(/Uploading removed item image (\d+)\/(\d+)/);
  if (im) {
    const cur = parseInt(im[1], 10);
    const tot = parseInt(im[2], 10);
    if (tot > 0) return 38 + Math.round((cur / tot) * 22);
  }
  if (/Saving products to cloud/i.test(m)) return 62;
  if (/Saving removed items to cloud/i.test(m)) return 70;
  if (/Updating cloud records/i.test(m)) return 78;
  if (/Refreshing from cloud/i.test(m)) return 84;
  const ofMatch = m.match(/(\d+)\s+of\s+(\d+)/);
  if (ofMatch) {
    const cur = parseInt(ofMatch[1], 10);
    const tot = parseInt(ofMatch[2], 10);
    if (tot > 0) return 85 + Math.round((cur / tot) * 13);
  }
  if (/Loading data from cloud/i.test(m)) return 86;
  if (/Saving catalogue on device/i.test(m)) return 96;
  return 50;
}

function applyUserSettingsFromCloud(us: any) {
  if (!us) return;

  if (typeof us.watermark_enabled === 'boolean') {
    safeSetInStorage('showWatermark', us.watermark_enabled);
  } else if (typeof us.showWatermark === 'boolean') {
    safeSetInStorage('showWatermark', us.showWatermark);
  }

  if (typeof us.watermark_text === 'string' && us.watermark_text.length > 0) {
    safeSetInStorage('watermarkText', us.watermark_text);
  } else if (typeof us.watermarkText === 'string' && us.watermarkText.length > 0) {
    safeSetInStorage('watermarkText', us.watermarkText);
  }

  if (typeof us.currency === 'string' && us.currency.length > 0) {
    localStorage.setItem('defaultCurrency', us.currency);
  } else if (typeof us.defaultCurrency === 'string' && us.defaultCurrency.length > 0) {
    localStorage.setItem('defaultCurrency', us.defaultCurrency);
  }

  if (Array.isArray(us.price_units)) {
    localStorage.setItem('priceFieldUnits', JSON.stringify(us.price_units));
  }

  const watermarkPosition =
    (us.data && typeof us.data === 'object' ? us.data.watermarkPosition : undefined) ||
    (typeof us.watermarkPosition === 'string' ? us.watermarkPosition : undefined);
  if (typeof watermarkPosition === 'string' && watermarkPosition.length > 0) {
    safeSetInStorage('watermarkPosition', watermarkPosition);
  }

  if (us.data && typeof us.data === 'object' && us.data.customCurrencies && typeof us.data.customCurrencies === 'object') {
    safeSetInStorage('customCurrencies', us.data.customCurrencies);
  }

  if (us.data && typeof us.data === 'object' && us.data.businessProfile && typeof us.data.businessProfile === 'object') {
    try {
      localStorage.setItem('businessProfile', JSON.stringify(us.data.businessProfile));
    } catch {
      /* ignore */
    }
  }
}

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusDetail, setSyncStatusDetail] = useState<string | null>(null);
  const [syncProgressPercent, setSyncProgressPercent] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncLockRef = useRef(false);

  const isStrictMode = useCallback(() => {
    return localStorage.getItem('strictOnlineMode::device') === 'true';
  }, []);

  const refreshFromCloud = useCallback(async (
    opts?: RefreshFromCloudOptions
  ): Promise<{ products: any[]; deletedProducts: any[] } | null> => {
    if (!user?.uid) return null;
    const userId = user.uid;

    opts?.onStatus?.('Loading data from cloud…');

    const { fetchAllUserData } = await import('../services/supabaseSync');
    const result = await fetchAllUserData(userId);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch cloud data');
    }

    const snapshot = result.data;

    const nextProducts = Array.isArray(snapshot.products) ? snapshot.products : [];
    const nextDeleted = Array.isArray(snapshot.deletedProducts) ? snapshot.deletedProducts : [];

    const deletedIds = new Set<string>(
      nextDeleted.map((p: any) => p?.id).filter((id: any) => id != null).map((id: any) => String(id))
    );
    const filteredProducts = nextProducts.filter(
      (p: any) => p?.id != null && !deletedIds.has(String(p.id))
    );

    opts?.onStatus?.('Saving catalogue on device…');

    const cachedProducts = await cacheCloudProductImages(userId, filteredProducts, (info) => {
      const suffix = info.productName ? ` · ${info.productName}` : '';
      opts?.onStatus?.(`Syncing product ${info.current} of ${info.total}${suffix}`);
    });
    const cachedDeleted = await cacheCloudProductImages(userId, nextDeleted, (info) => {
      const suffix = info.productName ? ` · ${info.productName}` : '';
      opts?.onStatus?.(`Syncing removed item ${info.current} of ${info.total}${suffix}`);
    });

    let storedProducts = cachedProducts;
    let storedDeleted = cachedDeleted;
    if (Capacitor.isNativePlatform()) {
      const { migrateProductImagePaths } = await import('../utils/dataMigration');
      const mp = [...cachedProducts];
      const md = [...cachedDeleted];
      await migrateProductImagePaths(mp, userId);
      await migrateProductImagePaths(md, userId);
      storedProducts = mp;
      storedDeleted = md;
    }

    safeSetInStorage(getProductsKey(userId), storedProducts);
    safeSetInStorage(getDeletedProductsKey(userId), storedDeleted);

    const rawCats = snapshot.categories || [];
    const normalizedCats = rawCats.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
    const categoriesJson = JSON.stringify(normalizedCats);
    localStorage.setItem('categories', categoriesJson);
    localStorage.setItem(getStorageKey('categories', userId), categoriesJson);

    if (snapshot.fieldsDefinition) {
      setFieldsDefinition(snapshot.fieldsDefinition, userId);
    }
    if (snapshot.cataloguesDefinition) {
      setCataloguesDefinition(snapshot.cataloguesDefinition, userId);
    }

    applyUserSettingsFromCloud(snapshot.userSettings);

    return { products: storedProducts, deletedProducts: storedDeleted };
  }, [user?.uid]);

  const syncProductsToCloud = useCallback(async (
    products: any[],
    deletedProducts: any[],
    options?: SyncProductsToCloudOptions
  ): Promise<{ products: any[]; deletedProducts: any[] }> => {
    if (!user?.uid) throw new Error('Not authenticated');

    if (!isStrictMode()) {
      return { products, deletedProducts };
    }

    if (syncLockRef.current) {
      return { products, deletedProducts };
    }

    const detailedStatus = options?.detailedStatus === true;

    syncLockRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    setSyncProgressPercent(0);
    if (detailedStatus) {
      setSyncStatusDetail('Preparing sync…');
      setSyncProgressPercent(computeSyncPercentFromDetail('Preparing sync…'));
    } else {
      setSyncStatusDetail(null);
    }

    try {
      const userId = user.uid;
      const setDetail = (message: string) => {
        if (detailedStatus) {
          setSyncStatusDetail(message);
          setSyncProgressPercent(computeSyncPercentFromDetail(message));
        }
      };

      // Helper: upload missing R2 images (reads Data + External + legacy paths like hydration)
      const uploadMissingImages = async (items: any[], phaseLabel: string): Promise<any[]> => {
        const missing = items.filter((p: any) => {
          const hasHttps =
            typeof p.imageUrl === 'string' && /^https?:\/\//i.test(p.imageUrl.trim());
          return !hasHttps && p.imagePath;
        });
        if (missing.length === 0) return items;

        const { uploadProductImageToR2 } = await import('../services/r2Upload');

        if (!Capacitor.isNativePlatform()) {
          assertProductsHaveCloudImageUrlForSync(items, phaseLabel);
          return items;
        }

        const total = missing.length;
        let finished = 0;

        const uploadedPairs = await Promise.all(
          missing.map(async (p: any, slot: number) => {
            const rawName = typeof p.name === 'string' ? p.name.trim() : '';
            const shortName =
              rawName.length > 36 ? `${rawName.slice(0, 33)}…` : rawName || undefined;
            const slotMsg = shortName
              ? `${phaseLabel} ${slot + 1}/${total} · ${shortName}`
              : `${phaseLabel} ${slot + 1}/${total}`;
            setDetail(slotMsg);

            try {
              let base64: string | null = null;
              for (let attempt = 0; attempt < 3; attempt++) {
                base64 = await readProductSourceBase64ForCloudUpload(p);
                if (base64) break;
                if (attempt < 2) await new Promise((r) => setTimeout(r, 180));
              }
              if (!base64) {
                throw new Error(
                  `Cannot read image file for product "${p.name || p.id}" (${p.id}). ` +
                    `The file may be missing or still writing — try sync again in a moment.`
                );
              }
              const pathHint =
                typeof p.imagePath === 'string' && p.imagePath.trim() ? p.imagePath.trim() : '';
              const filename = (pathHint.split('/').pop() || 'product.png').toLowerCase();
              const dataUrlPrefix =
                filename.endsWith('.jpg') || filename.endsWith('.jpeg')
                  ? 'data:image/jpeg;base64,'
                  : 'data:image/png;base64,';
              const uploaded = await uploadProductImageToR2({
                productId: String(p.id),
                dataUrl: `${dataUrlPrefix}${base64}`,
              });
              if (!uploaded?.url) {
                throw new Error(`Cloud upload returned no URL for product ${p.id}`);
              }
              return { productId: p.id, imageUrl: uploaded.url };
            } catch (err) {
              console.error(`❌ Image upload failed for product ${p.id}:`, err);
              throw err;
            } finally {
              finished += 1;
              setDetail(`${phaseLabel} ${finished}/${total}`);
            }
          })
        );

        const urlMap = new Map(
          uploadedPairs.map((x: any) => [String(x.productId), x.imageUrl])
        );
        const merged = items.map((p: any) => {
          const url = urlMap.get(String(p.id));
          return url ? { ...p, imageUrl: url } : p;
        });
        assertProductsHaveCloudImageUrlForSync(merged, phaseLabel);
        return merged;
      };

      // Upload images for both active and deleted products
      let productsForSync = await uploadMissingImages(
        Array.isArray(products) ? [...products] : [],
        'Uploading image'
      );
      let deletedForSync = await uploadMissingImages(
        Array.isArray(deletedProducts) ? [...deletedProducts] : [],
        'Uploading removed item image'
      );

      const {
        syncProducts, syncDeletedProducts,
        removeFromProductsTable, removeFromDeletedProductsTable,
      } = await import('../services/supabaseSync');

      // Active products -> products table
      if (productsForSync.length > 0) {
        setDetail('Saving products to cloud…');
        const res = await syncProducts(userId, productsForSync);
        if (!res.success) throw new Error(res.error || 'Products sync failed');
      }

      // Deleted products -> deleted_products table (with full data)
      if (deletedForSync.length > 0) {
        setDetail('Saving removed items to cloud…');
        const res = await syncDeletedProducts(userId, deletedForSync);
        if (!res.success) throw new Error(res.error || 'Deleted products sync failed');
      }

      // Cleanup: remove shelved products from products table,
      // and restored products from deleted_products table.
      const activeIds = new Set(productsForSync.map((p: any) => String(p.id)));
      const deletedIds = new Set(deletedForSync.map((p: any) => String(p.id)));

      const idsToRemoveFromProducts = deletedForSync
        .map((p: any) => String(p.id))
        .filter((id: string) => !activeIds.has(id));
      const idsToRemoveFromDeleted = productsForSync
        .map((p: any) => String(p.id))
        .filter((id: string) => !deletedIds.has(id));

      setDetail('Updating cloud records…');
      await Promise.all([
        removeFromProductsTable(userId, idsToRemoveFromProducts),
        removeFromDeletedProductsTable(userId, idsToRemoveFromDeleted),
      ]);

      setDetail('Refreshing from cloud…');
      const cloudData = await refreshFromCloud(
        detailedStatus ? { onStatus: setDetail } : undefined
      );
      if (!cloudData) throw new Error('Cloud refresh returned null');

      return cloudData;
    } catch (err: any) {
      const msg = err?.message || 'Sync failed';
      setSyncError(msg);
      throw err;
    } finally {
      syncLockRef.current = false;
      setIsSyncing(false);
      setSyncStatusDetail(null);
      setSyncProgressPercent(0);
    }
  }, [user?.uid, isStrictMode, refreshFromCloud]);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        syncStatusDetail,
        syncProgressPercent,
        syncError,
        syncProductsToCloud,
        refreshFromCloud,
        isStrictMode,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export { applyUserSettingsFromCloud };
