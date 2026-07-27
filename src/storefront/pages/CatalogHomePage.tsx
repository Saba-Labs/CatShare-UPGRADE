import type { HomepageLayout } from '../../types/homepage';

import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';

import type { StorePublic } from '../../services/storeService';

import type { WebsiteOrderBridgeValue } from '../../components/WebsiteBuilder/WebsiteOrderBridge';

import { WebsiteOrderBridgeProvider } from '../../components/WebsiteBuilder/WebsiteOrderBridge';

import { WebsiteStoreProvider } from '../../components/WebsiteBuilder/WebsiteStoreContext';
import StorefrontSiteHeader from '../../components/Storefront/StorefrontSiteHeader';
import { storeBasePath } from '../../utils/websiteStorefront';
import { homepageUsesHeroHeaderOverlay } from '../../utils/immersiveHeaderOverlay';

import CatalogLayoutRuntime from '../CatalogLayoutRuntime';

import CatalogStoreHero from '../components/CatalogStoreHero';



interface CatalogHomePageProps {

  slug: string;

  store: StorePublic;

  products: ProductWithCatalogueData[];
  productsLoading?: boolean;

  layout: HomepageLayout;

  orderBridge: WebsiteOrderBridgeValue;

  onSubdomain?: boolean;
  showSiteHeader?: boolean;

}



/** Catalog / default-store homepage — classic sv-hero + published layout sections. */

export default function CatalogHomePage({

  slug,

  store,

  products,
  productsLoading = false,

  layout,

  orderBridge,

  onSubdomain,
  showSiteHeader = false,

}: CatalogHomePageProps) {
  const siteSettings = layout.websiteConfig?.siteSettings;
  const hasSiteHeader = showSiteHeader && !!siteSettings;
  const basePath = storeBasePath(slug, onSubdomain);
  const heroHeaderOverlay = homepageUsesHeroHeaderOverlay(
    siteSettings?.headerVariant,
    layout.sections ?? layout.websiteConfig?.pages?.home?.sections
  );

  return (

    <WebsiteStoreProvider
      slug={slug}
      store={store}
      products={products}
      productsLoading={productsLoading}
      onSubdomain={onSubdomain}
    >

      <WebsiteOrderBridgeProvider value={orderBridge}>

        <div
          className={`website-runtime-root${heroHeaderOverlay ? ' website-runtime-root--hero-overlay' : ''}`}
        >
        {hasSiteHeader ? (
          <StorefrontSiteHeader
            siteSettings={siteSettings}
            store={store}
            basePath={basePath}
            heroOverlay={heroHeaderOverlay}
          />
        ) : (
          <CatalogStoreHero store={store} />
        )}

        <CatalogLayoutRuntime layout={layout} storeId={store.id} />
        </div>

      </WebsiteOrderBridgeProvider>

    </WebsiteStoreProvider>

  );

}
