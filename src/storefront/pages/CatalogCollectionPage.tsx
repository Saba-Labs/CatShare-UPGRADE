import type { HomepageLayout } from '../../types/homepage';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import type { WebsiteOrderBridgeValue } from '../../components/WebsiteBuilder/WebsiteOrderBridge';
import { WebsiteOrderBridgeProvider } from '../../components/WebsiteBuilder/WebsiteOrderBridge';
import { WebsiteStoreProvider } from '../../components/WebsiteBuilder/WebsiteStoreContext';
import StorefrontSiteHeader from '../../components/Storefront/StorefrontSiteHeader';
import CollectionPageRuntime from '../../components/WebsiteBuilder/pages/CollectionPageRuntime';
import { buildWebsiteThemeVars } from '../../utils/websiteThemeVars';
import { storeBasePath } from '../../utils/websiteStorefront';
import { resolveCollectionPageSettings } from '../../utils/collectionPageSettings';

interface CatalogCollectionPageProps {
  slug: string;
  store: StorePublic;
  products: ProductWithCatalogueData[];
  productsLoading?: boolean;
  layout: HomepageLayout | null;
  orderBridge: WebsiteOrderBridgeValue;
  onSubdomain?: boolean;
  showSiteHeader?: boolean;
  onBack?: () => void;
}

export default function CatalogCollectionPage({
  slug,
  store,
  products,
  productsLoading = false,
  layout,
  orderBridge,
  onSubdomain,
  showSiteHeader = false,
  onBack,
}: CatalogCollectionPageProps) {
  const siteSettings = layout?.websiteConfig?.siteSettings;
  const homeTheme = layout?.websiteConfig?.pages?.home?.theme ?? layout?.theme;
  const themeVars = buildWebsiteThemeVars(homeTheme);
  const settings = resolveCollectionPageSettings(layout);
  const basePath = storeBasePath(slug, onSubdomain);
  const storeName = siteSettings?.websiteName || store.sellerBusinessName || store.storeSlug || slug;

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
          className="website-runtime-root website-catalog-collection-shell"
          style={{
            minHeight: '100%',
            background: homeTheme?.backgroundColor || '#fff',
            color: homeTheme?.textColor,
            fontFamily: homeTheme?.fontFamily,
            ...themeVars,
          }}
        >
          {showSiteHeader && siteSettings ? (
            <StorefrontSiteHeader
              siteSettings={siteSettings}
              store={store}
              basePath={basePath}
              pageSurface="inner"
            />
          ) : onBack ? (
            <div className="sv-catalog-product-top">
              <button
                type="button"
                className="sv-catalog-product-back"
                onClick={onBack}
                aria-label="Back to shop"
              >
                ←
              </button>
              <div className="sv-catalog-product-top-meta">
                <div className="sv-store-name">{storeName}</div>
              </div>
            </div>
          ) : null}
          <CollectionPageRuntime
            products={products}
            productsLoading={productsLoading}
            embedded
            columns={settings.columns}
            showCategoryFilters={settings.showCategoryFilters}
            showSort={settings.showSort}
            viewMode={settings.viewMode}
            cardsStyle={settings.cardsStyle}
            productImageRatio={settings.productImageRatio}
            showPrice={settings.showPrice}
            showAvailability={settings.showAvailability}
            defaultSorting={settings.defaultSorting}
          />
        </div>
      </WebsiteOrderBridgeProvider>
    </WebsiteStoreProvider>
  );
}
