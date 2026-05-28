import { useMemo } from 'react';
import type { HomepageLayout } from '../../types/homepage';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import { createDefaultWebsiteModeConfig } from '../../config/homepageBuilderConfig';
import { resolveStorefrontSeo, type StorefrontPageKind } from '../../utils/storefrontSeo';
import { slugifyStorefront } from '../../utils/websiteStorefront';
import StorefrontSeo from './StorefrontSeo';
import { WebsiteStoreProvider } from './WebsiteStoreContext';
import WebsiteHeader from './WebsiteHeader';
import WebsiteFooter from './WebsiteFooter';
import HomePageRuntime from './pages/HomePageRuntime';
import CollectionPageRuntime from './pages/CollectionPageRuntime';
import ProductPageRuntime from './pages/ProductPageRuntime';
import './website-runtime.css';

interface WebsiteRuntimeProps {
  slug: string;
  pathname: string;
  homepageLayout: HomepageLayout | null;
  products: ProductWithCatalogueData[];
  store: StorePublic;
  onSubdomain?: boolean;
}

export default function WebsiteRuntime({
  slug,
  pathname,
  homepageLayout,
  products,
  store,
  onSubdomain = false,
}: WebsiteRuntimeProps) {
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
    ? products.find((p) => slugifyStorefront(p.name || p.id) === handle) || null
    : null;
  const customPage = section
    ? customPages.find((page) => page.slug === section || slugifyStorefront(page.slug) === section)
    : null;
  const customPageLayout = customPage
    ? {
        sections: customPage.layout.sections || [],
        theme: customPage.layout.theme || homeLayout.theme,
      }
    : null;

  const pageKind: StorefrontPageKind = section === 'collections'
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

  return (
    <WebsiteStoreProvider slug={slug} store={store} products={products} onSubdomain={onSubdomain}>
      <StorefrontSeo
        seo={seo}
        googleSiteVerification={websiteConfig.seo?.googleSiteVerification}
        faviconUrl={websiteConfig.seo?.faviconUrl}
      />
      <div style={{ minHeight: '100vh', background: homeLayout.theme?.backgroundColor || '#fff' }}>
        <WebsiteHeader slug={slug} siteSettings={{ ...websiteConfig.siteSettings, websiteName: storeDisplayName }} onSubdomain={onSubdomain} />
        {section === 'collections' ? (
          <CollectionPageRuntime products={products} columns={websiteConfig.templates?.collection?.columns || 4} />
        ) : section === 'products' ? (
          <ProductPageRuntime product={product} />
        ) : customPageLayout ? (
          <HomePageRuntime layout={customPageLayout as HomepageLayout} />
        ) : (
          <HomePageRuntime layout={homeLayout} />
        )}
        <WebsiteFooter siteSettings={websiteConfig.siteSettings} />
      </div>
    </WebsiteStoreProvider>
  );
}
