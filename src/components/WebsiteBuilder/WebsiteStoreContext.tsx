import React, { createContext, useContext, useMemo } from 'react';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import {
  collectionPagePath,
  currencySymbolFor,
  productPagePath,
  storeBasePath,
} from '../../utils/websiteStorefront';

export interface WebsiteStoreContextValue {
  slug: string;
  basePath: string;
  products: ProductWithCatalogueData[];
  store: StorePublic;
  currencySymbol: string;
  productPath: (product: ProductWithCatalogueData) => string;
  collectionPath: string;
}

const WebsiteStoreContext = createContext<WebsiteStoreContextValue | null>(null);

export function WebsiteStoreProvider({
  slug,
  store,
  products,
  onSubdomain,
  children,
}: {
  slug: string;
  store: StorePublic;
  products: ProductWithCatalogueData[];
  onSubdomain?: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo<WebsiteStoreContextValue>(() => {
    const basePath = storeBasePath(slug, onSubdomain);
    return {
      slug,
      basePath,
      products,
      store,
      currencySymbol: currencySymbolFor(store.sellerCurrencyCode),
      productPath: (product) => productPagePath(slug, product, onSubdomain),
      collectionPath: collectionPagePath(slug, onSubdomain),
    };
  }, [slug, store, products, onSubdomain]);

  return <WebsiteStoreContext.Provider value={value}>{children}</WebsiteStoreContext.Provider>;
}

export function useWebsiteStore(): WebsiteStoreContextValue {
  const ctx = useContext(WebsiteStoreContext);
  if (!ctx) throw new Error('useWebsiteStore requires WebsiteStoreProvider');
  return ctx;
}

export function useWebsiteStoreOptional(): WebsiteStoreContextValue | null {
  return useContext(WebsiteStoreContext);
}
