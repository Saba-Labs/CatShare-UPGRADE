import React, { createContext, useContext, useCallback, useState, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from '../utils/safeStorage';
import { getFieldsDefinition, setFieldsDefinition } from '../config/fieldConfig';
import { getCataloguesDefinition, setCataloguesDefinition } from '../config/catalogueConfig';

interface SyncContextType {
  isSyncing: boolean;
  syncError: string | null;
  syncProductsToCloud: (products: any[], deletedProducts: any[]) => Promise<{ products: any[]; deletedProducts: any[] }>;
  refreshFromCloud: () => Promise<{ products: any[]; deletedProducts: any[] } | null>;
  isStrictMode: () => boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const getProductsKey = (uid: string) => getStorageKey('products', uid);
const getDeletedProductsKey = (uid: string) => getStorageKey('deletedProducts', uid);

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

  if (typeof us.whatsapp_number === 'string' && us.whatsapp_number.length > 0) {
    localStorage.setItem('whatsappNumber', us.whatsapp_number);
  }
}

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncLockRef = useRef(false);

  const isStrictMode = useCallback(() => {
    return localStorage.getItem('strictOnlineMode::device') === 'true';
  }, []);

  const refreshFromCloud = useCallback(async (): Promise<{ products: any[]; deletedProducts: any[] } | null> => {
    if (!user?.uid) return null;
    const userId = user.uid;

    const { fetchAllUserData } = await import('../services/supabaseSync');
    const result = await fetchAllUserData(userId);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch cloud data');
    }

    const snapshot = result.data;

    const nextProducts = Array.isArray(snapshot.products) ? snapshot.products : [];
    const nextDeleted = Array.isArray(snapshot.deletedProducts) ? snapshot.deletedProducts : [];

    const deletedIds = new Set(nextDeleted.map((p: any) => p.id));
    const filteredProducts = nextProducts.filter((p: any) => !deletedIds.has(p.id));

    safeSetInStorage(getProductsKey(userId), filteredProducts);
    safeSetInStorage(getDeletedProductsKey(userId), nextDeleted);

    const rawCats = snapshot.categories || [];
    const normalizedCats = rawCats.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
    localStorage.setItem('categories', JSON.stringify(normalizedCats));

    if (snapshot.fieldsDefinition) {
      setFieldsDefinition(snapshot.fieldsDefinition, userId);
    }
    if (snapshot.cataloguesDefinition) {
      setCataloguesDefinition(snapshot.cataloguesDefinition, userId);
    }

    applyUserSettingsFromCloud(snapshot.userSettings);

    return { products: filteredProducts, deletedProducts: nextDeleted };
  }, [user?.uid]);

  const syncProductsToCloud = useCallback(async (
    products: any[],
    deletedProducts: any[]
  ): Promise<{ products: any[]; deletedProducts: any[] }> => {
    if (!user?.uid) throw new Error('Not authenticated');

    if (!isStrictMode()) {
      return { products, deletedProducts };
    }

    if (syncLockRef.current) {
      return { products, deletedProducts };
    }

    syncLockRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      const userId = user.uid;

      // Helper: upload missing R2 images for any product array
      const uploadMissingImages = async (items: any[]): Promise<any[]> => {
        const missing = items.filter((p: any) => !p.imageUrl && p.imagePath);
        if (missing.length === 0) return items;

        const { uploadProductImageToR2 } = await import('../services/r2Upload');
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        const uploadedPairs = await Promise.all(
          missing.map(async (p: any) => {
            try {
              const fileData = await Filesystem.readFile({
                path: p.imagePath,
                directory: Directory.Data,
              });
              const filename = (p.imagePath.split('/').pop() || '').toLowerCase();
              const dataUrlPrefix =
                filename.endsWith('.jpg') || filename.endsWith('.jpeg')
                  ? 'data:image/jpeg;base64,'
                  : 'data:image/png;base64,';
              const uploaded = await uploadProductImageToR2({
                productId: String(p.id),
                dataUrl: `${dataUrlPrefix}${fileData.data}`,
              });
              if (!uploaded?.url) return null;
              return { productId: p.id, imageUrl: uploaded.url };
            } catch (err) {
              console.warn(`⚠️ Image upload failed for product ${p.id}:`, err);
              return null;
            }
          })
        );

        const urlMap = new Map(
          uploadedPairs.filter(Boolean).map((x: any) => [String(x.productId), x.imageUrl])
        );
        return items.map((p: any) => {
          const url = urlMap.get(String(p.id));
          return url ? { ...p, imageUrl: url } : p;
        });
      };

      // Upload images for both active and deleted products
      let productsForSync = await uploadMissingImages(
        Array.isArray(products) ? [...products] : []
      );
      let deletedForSync = await uploadMissingImages(
        Array.isArray(deletedProducts) ? [...deletedProducts] : []
      );

      const { syncProducts, syncDeletedProducts } = await import('../services/supabaseSync');

      // Active products -> products table
      if (productsForSync.length > 0) {
        const res = await syncProducts(userId, productsForSync);
        if (!res.success) throw new Error(res.error || 'Products sync failed');
      }

      // Deleted products -> deleted_products table (with full data)
      if (deletedForSync.length > 0) {
        const res = await syncDeletedProducts(userId, deletedForSync);
        if (!res.success) throw new Error(res.error || 'Deleted products sync failed');
      }

      const cloudData = await refreshFromCloud();
      if (!cloudData) throw new Error('Cloud refresh returned null');

      return cloudData;
    } catch (err: any) {
      const msg = err?.message || 'Sync failed';
      setSyncError(msg);
      throw err;
    } finally {
      syncLockRef.current = false;
      setIsSyncing(false);
    }
  }, [user?.uid, isStrictMode, refreshFromCloud]);

  return (
    <SyncContext.Provider value={{ isSyncing, syncError, syncProductsToCloud, refreshFromCloud, isStrictMode }}>
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
