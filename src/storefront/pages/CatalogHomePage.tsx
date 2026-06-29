import type { HomepageLayout } from '../../types/homepage';

import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';

import type { StorePublic } from '../../services/storeService';

import type { WebsiteOrderBridgeValue } from '../../components/WebsiteBuilder/WebsiteOrderBridge';

import { WebsiteOrderBridgeProvider } from '../../components/WebsiteBuilder/WebsiteOrderBridge';

import { WebsiteStoreProvider } from '../../components/WebsiteBuilder/WebsiteStoreContext';

import CatalogLayoutRuntime from '../CatalogLayoutRuntime';

import CatalogStoreHero from '../components/CatalogStoreHero';



interface CatalogHomePageProps {

  slug: string;

  store: StorePublic;

  products: ProductWithCatalogueData[];

  layout: HomepageLayout;

  orderBridge: WebsiteOrderBridgeValue;

  onSubdomain?: boolean;

}



/** Catalog / default-store homepage — classic sv-hero + published layout sections. */

export default function CatalogHomePage({

  slug,

  store,

  products,

  layout,

  orderBridge,

  onSubdomain,

}: CatalogHomePageProps) {

  return (

    <WebsiteStoreProvider slug={slug} store={store} products={products} onSubdomain={onSubdomain}>

      <WebsiteOrderBridgeProvider value={orderBridge}>

        <CatalogStoreHero store={store} />

        <CatalogLayoutRuntime layout={layout} storeId={store.id} />

      </WebsiteOrderBridgeProvider>

    </WebsiteStoreProvider>

  );

}

