import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import type { Catalogue } from '../../../config/catalogueConfig';
import { getStoreProducts, type StorePublic } from '../../../services/storeService';
import { getCatalogueRowsFromDeviceStorage } from '../../../utils/catalogueCachePersist';
import type { BusinessProfile } from '../../../config/businessProfile';
import {
  BUSINESS_PROFILE_UPDATED_EVENT,
  businessProfileToPreviewStoreFields,
  readCachedBusinessProfile,
} from '../../../utils/businessProfileStorefront';
import { deriveStoreCategories, type StoreCategory } from '../../../utils/storefrontCategories';
import { getSymbolForCurrencyCode } from '../../../utils/currencyUtils';
import { WebsiteStoreProvider } from '../../WebsiteBuilder/WebsiteStoreContext';
import BuilderProductPreviewBridge from '../BuilderProductPreviewBridge';

const PRODUCTS_FETCH_TIMEOUT_MS = 12_000;

interface BuilderCatalogueContextValue {
  products: ProductWithCatalogueData[];
  categories: StoreCategory[];
  loading: boolean;
  error: string | null;
  currencyCode: string;
  catalogueId: string;
  reload: () => void;
}

const BuilderCatalogueContext = createContext<BuilderCatalogueContextValue | null>(null);

interface BuilderCatalogueProviderProps {
  storeId: string;
  storeSlug?: string;
  sellerUserId?: string;
  catalogues?: Catalogue[];
  catalogueId?: string;
  currencyCode?: string;
  storeWhatsapp?: string | null;
  children: React.ReactNode;
}

export function BuilderCatalogueProvider({
  storeId,
  storeSlug,
  sellerUserId,
  catalogues,
  catalogueId,
  currencyCode,
  storeWhatsapp,
  children,
}: BuilderCatalogueProviderProps) {
  const [products, setProducts] = useState<ProductWithCatalogueData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => readCachedBusinessProfile());

  useEffect(() => {
    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<BusinessProfile>).detail;
      setBusinessProfile(detail ?? readCachedBusinessProfile());
    };
    window.addEventListener(BUSINESS_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => window.removeEventListener(BUSINESS_PROFILE_UPDATED_EVENT, onProfileUpdated);
  }, []);

  // Keep the latest catalogues without retriggering fetches on identity changes.
  const cataloguesRef = useRef(catalogues);
  cataloguesRef.current = catalogues;

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!sellerUserId) {
      setProducts([]);
      return;
    }

    // The editor is opened by the logged-in seller, so their catalogue is already
    // cached on-device by the app. Read it instantly — no network round-trip.
    const local = getCatalogueRowsFromDeviceStorage(sellerUserId);
    if (local.products.length > 0) {
      setProducts(local.products as ProductWithCatalogueData[]);
      setLoading(false);
      setError(null);
      return;
    }

    // Fallback: cache empty (e.g. fresh device) — fetch from cloud with a timeout.
    setLoading(true);
    setError(null);

    const timeout = new Promise<{ success: false; error: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'Request timed out. Check your connection and retry.' }), PRODUCTS_FETCH_TIMEOUT_MS)
    );

    Promise.race([getStoreProducts(sellerUserId, cataloguesRef.current), timeout])
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.products) {
          setProducts(result.products as ProductWithCatalogueData[]);
        } else {
          setError(result.error || 'Failed to load products');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(/failed to fetch/i.test(msg) ? 'Could not reach the server. Check your connection and retry.' : msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerUserId, reloadKey]);

  const categories = useMemo(() => deriveStoreCategories(products), [products]);

  const value = useMemo<BuilderCatalogueContextValue>(
    () => ({
      products,
      categories,
      loading,
      error,
      currencyCode: currencyCode || '',
      catalogueId: catalogueId || '',
      reload,
    }),
    [products, categories, loading, error, currencyCode, catalogueId, reload]
  );

  const previewCatalogue = useMemo(() => {
    if (!catalogues?.length) return null;
    if (catalogueId) {
      return catalogues.find((c) => c.id === catalogueId) ?? catalogues[0];
    }
    return catalogues[0];
  }, [catalogues, catalogueId]);

  const currencySymbol = useMemo(
    () => getSymbolForCurrencyCode(currencyCode || 'INR'),
    [currencyCode]
  );

  const previewStore = useMemo<StorePublic>(() => {
    const bp = businessProfile;
    const fromProfile = businessProfileToPreviewStoreFields(bp);
    return {
      id: storeId,
      storeId,
      sellerUserId: sellerUserId || '',
      storeSlug: storeSlug || '',
      catalogueId: catalogueId || '',
      sellerCurrencyCode: currencyCode || 'INR',
      sellerLogoUrl: fromProfile.sellerLogoUrl || '',
      createdAt: new Date().toISOString(),
      sellerBusinessName: fromProfile.sellerBusinessName,
      sellerAbout: fromProfile.sellerAbout,
      sellerDescription: fromProfile.sellerDescription,
      sellerEmail: fromProfile.sellerEmail,
      sellerPhone: fromProfile.sellerPhone,
      sellerWebsite: fromProfile.sellerWebsite,
      sellerAddress: fromProfile.sellerAddress,
      instagram: fromProfile.instagram,
      twitter: fromProfile.twitter,
      facebook: fromProfile.facebook,
      whatsapp: storeWhatsapp || undefined,
      cataloguesDefinition: catalogues as StorePublic['cataloguesDefinition'],
    };
  }, [storeId, storeSlug, sellerUserId, catalogueId, currencyCode, catalogues, storeWhatsapp, businessProfile]);

  return (
    <BuilderCatalogueContext.Provider value={value}>
      <WebsiteStoreProvider slug={storeSlug || ''} store={previewStore} products={products}>
        <BuilderProductPreviewBridge currencySymbol={currencySymbol} catalogue={previewCatalogue}>
          {children}
        </BuilderProductPreviewBridge>
      </WebsiteStoreProvider>
    </BuilderCatalogueContext.Provider>
  );
}

export function useBuilderCatalogue(): BuilderCatalogueContextValue {
  const ctx = useContext(BuilderCatalogueContext);
  if (!ctx) {
    return { products: [], categories: [], loading: false, error: null, currencyCode: '', catalogueId: '', reload: () => {} };
  }
  return ctx;
}
