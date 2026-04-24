import React, { createContext, useContext, useCallback, useState, useRef, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from '../utils/safeStorage';
import { cacheCloudProductImages } from '../utils/productImageLocalCache';
import { readProductSourceBase64ForCloudUpload } from '../utils/productSourceImage';
import { assertProductsHaveCloudImageUrlForSync } from '../utils/syncImageValidation';
import { getFieldsDefinition, setFieldsDefinition } from '../config/fieldConfig';
import { getCataloguesDefinition, setCataloguesDefinition } from '../config/catalogueConfig';
import { mapWithConcurrencyLimit } from '../utils/concurrencyPool';

/** Max parallel image reads + R2 uploads (avoids OOM from huge Promise.all). */
const SYNC_UPLOAD_CONCURRENCY = 6;

/** Fired after native background image cache finishes writing `imagePath` to storage. */
export const CATALOGUE_LOCAL_IMAGES_READY_EVENT = 'catalogue-local-images-ready';

export type RefreshFromCloudOptions = {
  onStatus?: (message: string) => void;
  /**
   * When true (e.g. after sync-to-cloud), wait until all product images are cached to disk.
   * Default false: persist catalogue JSON immediately and cache images in parallel (faster startup).
   */
  blockUntilImagesCached?: boolean;
};

/** When true, updates `syncStatusDetail` during sync (full-screen overlay). Default false — routine saves stay on “Please wait…”. */
export type SyncProductsToCloudOptions = {
  detailedStatus?: boolean;
  onlyProductIds?: string[];
  background?: boolean;
  skipFullCloudRefresh?: boolean;
  fullListForPosition?: any[];   // ← add this line
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
  const dataObj = us.data && typeof us.data === 'object' ? us.data : {};

  const watermarkEnabled =
    typeof us.watermark_enabled === 'boolean'
      ? us.watermark_enabled
      : typeof us.showWatermark === 'boolean'
        ? us.showWatermark
        : typeof dataObj.watermark_enabled === 'boolean'
          ? dataObj.watermark_enabled
          : typeof dataObj.showWatermark === 'boolean'
            ? dataObj.showWatermark
            : undefined;
  if (typeof watermarkEnabled === 'boolean') {
    safeSetInStorage('showWatermark', watermarkEnabled);
    window.dispatchEvent(new CustomEvent('watermarkChanged', { detail: { value: watermarkEnabled } }));
  }

  const watermarkText =
    typeof us.watermark_text === 'string' && us.watermark_text.length > 0
      ? us.watermark_text
      : typeof us.watermarkText === 'string' && us.watermarkText.length > 0
        ? us.watermarkText
        : typeof dataObj.watermark_text === 'string' && dataObj.watermark_text.length > 0
          ? dataObj.watermark_text
          : typeof dataObj.watermarkText === 'string' && dataObj.watermarkText.length > 0
            ? dataObj.watermarkText
            : undefined;
  if (typeof watermarkText === 'string' && watermarkText.length > 0) {
    safeSetInStorage('watermarkText', watermarkText);
    window.dispatchEvent(new CustomEvent('watermarkTextChanged', { detail: { text: watermarkText } }));
  }

  if (typeof us.currency === 'string' && us.currency.length > 0) {
    localStorage.setItem('defaultCurrency', us.currency);
  } else if (typeof us.defaultCurrency === 'string' && us.defaultCurrency.length > 0) {
    localStorage.setItem('defaultCurrency', us.defaultCurrency);
  } else if (typeof dataObj.currency === 'string' && dataObj.currency.length > 0) {
    localStorage.setItem('defaultCurrency', dataObj.currency);
  } else if (typeof dataObj.defaultCurrency === 'string' && dataObj.defaultCurrency.length > 0) {
    localStorage.setItem('defaultCurrency', dataObj.defaultCurrency);
  }

  if (Array.isArray(us.price_units)) {
    localStorage.setItem('priceFieldUnits', JSON.stringify(us.price_units));
  } else if (Array.isArray(dataObj.price_units)) {
    localStorage.setItem('priceFieldUnits', JSON.stringify(dataObj.price_units));
  }

  const watermarkPosition =
    dataObj.watermarkPosition ||
    (typeof dataObj.watermark_position === 'string' ? dataObj.watermark_position : undefined) ||
    (typeof us.watermarkPosition === 'string' ? us.watermarkPosition : undefined);
  if (typeof watermarkPosition === 'string' && watermarkPosition.length > 0) {
    safeSetInStorage('watermarkPosition', watermarkPosition);
    window.dispatchEvent(new CustomEvent('watermarkPositionChanged', { detail: { position: watermarkPosition } }));
  }

  if (dataObj.customCurrencies && typeof dataObj.customCurrencies === 'object') {
    safeSetInStorage('customCurrencies', dataObj.customCurrencies);
  }

  if (dataObj.businessProfile && typeof dataObj.businessProfile === 'object') {
    try {
      localStorage.setItem('businessProfile', JSON.stringify(dataObj.businessProfile));
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
  /** Invalidate in-flight native image cache when a newer refreshFromCloud starts. */
  const imageCacheGenerationRef = useRef(0);

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

    // Invalidate any in-flight background cache from an older refresh before we write.
    imageCacheGenerationRef.current += 1;
    const sessionGen = imageCacheGenerationRef.current;

    opts?.onStatus?.('Saving catalogue on device…');

    const persistCatalogueMeta = () => {
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
    };

    const persistProducts = (prods: any[], del: any[]) => {
      safeSetInStorage(getProductsKey(userId), prods);
      safeSetInStorage(getDeletedProductsKey(userId), del);
    };

    /**
     * Download + write local files; run migrations; persist.
     * Aborts before writing if `sessionGen` no longer matches (newer refreshFromCloud started).
     */
    const runImageCacheAndPersist = async (
      sessionGen: number
    ): Promise<{ storedProducts: any[]; storedDeleted: any[] } | null> => {
      const prodCb = (info: { current: number; total: number; productName?: string }) => {
        const suffix = info.productName ? ` · ${info.productName}` : '';
        opts?.onStatus?.(`Syncing product ${info.current} of ${info.total}${suffix}`);
      };
      const delCb = (info: { current: number; total: number; productName?: string }) => {
        const suffix = info.productName ? ` · ${info.productName}` : '';
        opts?.onStatus?.(`Syncing removed item ${info.current} of ${info.total}${suffix}`);
      };

      const [cachedProducts, cachedDeleted] = await Promise.all([
        cacheCloudProductImages(userId, filteredProducts, prodCb),
        cacheCloudProductImages(userId, nextDeleted, delCb),
      ]);

      if (imageCacheGenerationRef.current !== sessionGen) {
        return null;
      }

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

      if (imageCacheGenerationRef.current !== sessionGen) {
        return null;
      }

      persistProducts(storedProducts, storedDeleted);
      return { storedProducts, storedDeleted };
    };

    persistCatalogueMeta();
    persistProducts(filteredProducts, nextDeleted);

    const block = opts?.blockUntilImagesCached === true;
    const native = Capacitor.isNativePlatform();

    if (!native || block) {
      const out = await runImageCacheAndPersist(sessionGen);
      if (!out) {
        console.warn('⚠️ refreshFromCloud: image cache superseded; returning snapshot without full local files');
        return { products: filteredProducts, deletedProducts: nextDeleted };
      }
      return { products: out.storedProducts, deletedProducts: out.storedDeleted };
    }

    void (async () => {
      try {
        const out = await runImageCacheAndPersist(sessionGen);
        if (!out || imageCacheGenerationRef.current !== sessionGen) return;
        window.dispatchEvent(
          new CustomEvent(CATALOGUE_LOCAL_IMAGES_READY_EVENT, { detail: { userId } })
        );
      } catch (e) {
        console.warn('⚠️ Background image cache failed:', e);
      }
    })();

    return { products: filteredProducts, deletedProducts: nextDeleted };
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
    const showSyncUi = options?.background !== true;

    syncLockRef.current = true;
    if (showSyncUi) {
      setIsSyncing(true);
      setSyncError(null);
      setSyncProgressPercent(0);
      if (detailedStatus) {
        setSyncStatusDetail('Preparing sync…');
        setSyncProgressPercent(computeSyncPercentFromDetail('Preparing sync…'));
      } else {
        setSyncStatusDetail(null);
      }
    }

    try {
      const userId = user.uid;
      const setDetail = (message: string) => {
        if (detailedStatus) {
          setSyncStatusDetail(message);
          setSyncProgressPercent(computeSyncPercentFromDetail(message));
        }
      };

      const onlyIdsRaw = options?.onlyProductIds?.filter(
        (id) => id != null && String(id).length > 0
      );
      const onlyIds = onlyIdsRaw?.map((id) => String(id)) ?? null;
      const isPartialProductSync = Array.isArray(onlyIds) && onlyIds.length > 0;

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

        const uploadedPairs = await mapWithConcurrencyLimit(
          missing,
          SYNC_UPLOAD_CONCURRENCY,
          async (p: any, slot: number) => {
            const rawName = typeof p.name === 'string' ? p.name.trim() : '';
            const shortName =
              rawName.length > 36 ? `${rawName.slice(0, 33)}…` : rawName || undefined;
            const slotMsg = shortName
              ? `${phaseLabel} ${slot + 1}/${total} · ${shortName}`
              : `${phaseLabel} ${slot + 1}/${total}`;
            setDetail(slotMsg);

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
            finished += 1;
            setDetail(`${phaseLabel} ${finished}/${total}`);
            return {
              productId: p.id,
              imageUrl: uploaded.url,
              imageVersion: Date.now(),
            };
          }
        );

        const uploadMap = new Map(
          uploadedPairs.map((x: any) => [String(x.productId), { url: x.imageUrl, version: x.imageVersion }])
        );
        const merged = items.map((p: any) => {
          const uploadedInfo = uploadMap.get(String(p.id));
          return uploadedInfo
            ? { ...p, imageUrl: uploadedInfo.url, imageVersion: uploadedInfo.version, image: '' }
            : p;
        });
        assertProductsHaveCloudImageUrlForSync(merged, phaseLabel);
        return merged;
      };

      if (isPartialProductSync) {
        const idSet = new Set(onlyIds);
        const subset: any[] = [];
        for (const p of Array.isArray(products) ? products : []) {
          if (p?.id != null && idSet.has(String(p.id))) {
            subset.push(p);
          }
        }
        if (subset.length === 0) {
          console.warn('⚠️ Partial sync: no products matched onlyProductIds', onlyIds);
          return { products, deletedProducts };
        }

        const { syncProducts } = await import('../services/supabaseSync');
        setDetail('Saving product to cloud…');
        const productsForSync = await uploadMissingImages(subset, 'Uploading image');
        const res = await syncProducts(userId, productsForSync, {
          fullListForPosition: Array.isArray(products) ? products : [],
        });
        if (!res.success) throw new Error(res.error || 'Products sync failed');
        return { products, deletedProducts };
      }

      // Upload images for both active and deleted products (full catalogue sync)
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
        const res = await syncProducts(userId, productsForSync, {
          fullListForPosition: options?.fullListForPosition ?? productsForSync,
        });
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

      if (options?.skipFullCloudRefresh === true) {
        return { products, deletedProducts };
      }

      setDetail('Refreshing from cloud…');
      const cloudData = await refreshFromCloud(
        detailedStatus
          ? { onStatus: setDetail, blockUntilImagesCached: true }
          : { blockUntilImagesCached: true }
      );
      if (!cloudData) throw new Error('Cloud refresh returned null');

      return cloudData;
    } catch (err: any) {
      const msg = err?.message || 'Sync failed';
      if (showSyncUi) {
        setSyncError(msg);
      }
      throw err;
    } finally {
      syncLockRef.current = false;
      if (showSyncUi) {
        setIsSyncing(false);
        setSyncStatusDetail(null);
        setSyncProgressPercent(0);
      }
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
