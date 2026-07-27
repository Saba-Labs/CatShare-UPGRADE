import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { HomepageLayout } from '../../types/homepage';
import { buildWebsiteThemeVars } from '../../utils/websiteThemeVars';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import { createDefaultWebsiteModeConfig } from '../../config/homepageBuilderConfig';
import { resolveStorefrontSeo, type StorefrontPageKind } from '../../utils/storefrontSeo';
import { findProductByHandle, findProductById, slugifyStorefront, type StoreProductNavState } from '../../utils/websiteStorefront';
import StorefrontSeo from './StorefrontSeo';
import { WebsiteStoreProvider } from './WebsiteStoreContext';
import WebsiteHeader from './WebsiteHeader';
import WebsiteFooter from './WebsiteFooter';
import HomePageRuntime from './pages/HomePageRuntime';
import CollectionPageRuntime from './pages/CollectionPageRuntime';
import ProductPageRuntime from './pages/ProductPageRuntime';
import { homepageUsesHeroHeaderOverlay } from '../../utils/immersiveHeaderOverlay';
import { resolveCollectionPageSettings } from '../../utils/collectionPageSettings';

interface WebsiteRuntimeProps {
  slug: string;
  pathname: string;
  homepageLayout: HomepageLayout | null;
  products: ProductWithCatalogueData[];
  productsLoading?: boolean;
  store: StorePublic;
  onSubdomain?: boolean;
}

export default function WebsiteRuntime({
  slug,
  pathname,
  homepageLayout,
  products,
  productsLoading = false,
  store,
  onSubdomain = false,
}: WebsiteRuntimeProps) {
  const location = useLocation();
  const fallback = createDefaultWebsiteModeConfig();
  const runtimeLayout = homepageLayout || { sections: [], theme: {}, websiteConfig: fallback };
  const websiteConfig = runtimeLayout.websiteConfig || fallback;
  const homeLayout = websiteConfig.pages?.home || runtimeLayout;
  const customPages = websiteConfig.pages?.custom || [];

  const segments = pathname.split('/').filter(Boolean);
  const storeSlugIndex = segments.findIndex((s) => s === 'store');
  const pageSegments = storeSlugIndex >= 0 ? segments.slice(storeSlugIndex + 2) : onSubdomain ? segments : [];
  const section = pageSegments[0] || '';
  const handle = pageSegments[1] || '';

  const product = section === 'products'
    ? (() => {
        const navState = location.state as StoreProductNavState | null;
        if (navState?.storeProductId) {
          const fromId = findProductById(products, navState.storeProductId);
          if (fromId) return fromId;
        }
        return findProductByHandle(products, handle);
      })()
    : null;
  const customPage = section
    ? customPages.find((page) => page.slug === section || slugifyStorefront(page.slug) === section)
    : null;
  const customPageLayout = customPage
    ? {
        sections: customPage.layout.sections || [],
        theme: homeLayout.theme,
      }
    : null;

  const pageKind: StorefrontPageKind = section === 'checkout'
    ? 'home'
    : section === 'collections'
    ? 'collection'
    : section === 'products'
      ? 'product'
      : customPage
        ? 'custom'
        : 'home';

  const seo = useMemo(
    () =>
      resolveStorefrontSeo({
        slug,
        storeName: store.sellerBusinessName || store.storeSlug || slug,
        storeDescription: store.sellerDescription || store.sellerAbout || undefined,
        logoUrl: store.sellerLogoUrl || websiteConfig.siteSettings.logoUrl,
        catalogueId: store.catalogueId,
        websiteConfig,
        pageKind,
        pathname,
        product,
        customPageTitle: customPage?.title,
        customPageSlug: customPage?.slug,
        onSubdomain,
      }),
    [slug, store, websiteConfig, pageKind, pathname, product, customPage, onSubdomain]
  );

  const storeDisplayName =
    websiteConfig.siteSettings.websiteName || store.sellerBusinessName || store.storeSlug;

  const themeVars = buildWebsiteThemeVars(homeLayout.theme);
  const productTemplate = websiteConfig.templates?.product;
  const collectionSettings = useMemo(
    () => resolveCollectionPageSettings(runtimeLayout),
    [runtimeLayout]
  );

  const innerPage =
    section === 'collections' || section === 'products' || section === 'checkout' || !!customPage;

  const heroHeaderOverlay =
    pageKind === 'home' &&
    homepageUsesHeroHeaderOverlay(websiteConfig.siteSettings.headerVariant, homeLayout.sections);

  return (
    <WebsiteStoreProvider
      slug={slug}
      store={store}
      products={products}
      productsLoading={productsLoading}
      onSubdomain={onSubdomain}
    >
      <StorefrontSeo
        seo={seo}
        googleSiteVerification={websiteConfig.seo?.googleSiteVerification}
        faviconUrl={websiteConfig.seo?.faviconUrl}
      />
      <div
        className={`website-runtime-root${heroHeaderOverlay ? ' website-runtime-root--hero-overlay' : ''}`}
        style={{ minHeight: '100vh', background: homeLayout.theme?.backgroundColor || '#fff', color: homeLayout.theme?.textColor, fontFamily: homeLayout.theme?.fontFamily, ...themeVars }}
      >
        <WebsiteHeader
          slug={slug}
          siteSettings={{ ...websiteConfig.siteSettings, websiteName: storeDisplayName }}
          onSubdomain={onSubdomain}
          pageSurface={innerPage ? 'inner' : 'homepage'}
          heroOverlay={heroHeaderOverlay}
        />
        {section === 'collections' ? (
          <CollectionPageRuntime
            products={products}
            productsLoading={productsLoading}
            embedded
            columns={collectionSettings.columns}
            cardsStyle={collectionSettings.cardsStyle}
            showCategoryFilters={collectionSettings.showCategoryFilters}
            showSort={collectionSettings.showSort}
            viewMode={collectionSettings.viewMode}
            productImageRatio={collectionSettings.productImageRatio}
            showPrice={collectionSettings.showPrice}
            showAvailability={collectionSettings.showAvailability}
            defaultSorting={collectionSettings.defaultSorting}
          />
        ) : section === 'products' ? (
          <ProductPageRuntime product={product} template={productTemplate} />
        ) : customPageLayout ? (
          <HomePageRuntime layout={customPageLayout as HomepageLayout} />
        ) : (
          <HomePageRuntime layout={homeLayout} />
        )}
        <WebsiteFooter
          siteSettings={{ ...websiteConfig.siteSettings, websiteName: storeDisplayName }}
        />
      </div>
    </WebsiteStoreProvider>
  );
}
