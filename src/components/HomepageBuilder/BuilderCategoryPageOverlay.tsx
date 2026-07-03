import { useEffect, useState } from 'react';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { ThemeSettings, WebsiteSiteSettings } from '../../types/homepage';
import {
  SITE_ANNOUNCEMENT_SELECTION_ID,
  SITE_FOOTER_SELECTION_ID,
  SITE_HEADER_SELECTION_ID,
} from '../../config/homepageBuilderConfig';
import { preventBuilderLinkNavigation } from '../../utils/builderNavigation';
import {
  isBuilderEditInteractionTarget,
  isBuilderSectionChromeTarget,
} from '../../utils/builderEditGuards';
import { isCatalogClassicFooter } from '../../config/footerVariants';
import { useBuilderCatalogue } from './catalogue/BuilderCatalogueContext';
import { resolveCollectionPageSettings } from '../../utils/collectionPageSettings';
import CollectionPageRuntime from '../WebsiteBuilder/pages/CollectionPageRuntime';
import WebsiteFooter from '../WebsiteBuilder/WebsiteFooter';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';
import { buildWebsiteThemeVars } from '../../utils/websiteThemeVars';
import { normalizeProductCardStyle } from '../../utils/productCardStyles';
import type { ViewportSize } from './BuilderToolbar';
import type { HomepageLayout } from '../../types/homepage';

export interface BuilderPreviewCategory {
  id: string;
  label: string;
}

interface BuilderCategoryPageOverlayProps {
  category: BuilderPreviewCategory;
  layout: HomepageLayout;
  theme: ThemeSettings;
  siteSettings?: WebsiteSiteSettings;
  viewport: ViewportSize;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  onClose: () => void;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
}

/** Category / collection page preview in the homepage editor. */
export default function BuilderCategoryPageOverlay({
  category,
  layout,
  theme,
  siteSettings,
  viewport,
  selectedSectionId,
  onSelectSection,
  onClose,
  onProductPreview,
}: BuilderCategoryPageOverlayProps) {
  const { products } = useBuilderCatalogue();
  const themeVars = buildWebsiteThemeVars(theme);
  const isSiteFooterSelected = selectedSectionId === SITE_FOOTER_SELECTION_ID;
  const isSiteAnnouncementSelected = selectedSectionId === SITE_ANNOUNCEMENT_SELECTION_ID;
  const isSiteHeaderSelected = selectedSectionId === SITE_HEADER_SELECTION_ID;
  const catalogClassicFooter = !!siteSettings && isCatalogClassicFooter(siteSettings);
  const [previewCategoryId, setPreviewCategoryId] = useState(category.id);

  useEffect(() => {
    setPreviewCategoryId(category.id);
  }, [category.id]);

  const settings = resolveCollectionPageSettings(layout);

  return (
    <div className={`builder-product-page-root viewport-${viewport}${viewport === 'mobile' ? ' product-page-layout-mobile' : ''}`}>
      <div className="builder-product-overlay__toolbar">
        <div>
          <p className="builder-product-overlay__eyebrow">Store catalog page</p>
          <p className="builder-product-overlay__title">{category.label}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Back to page
        </button>
      </div>

      <div className={`sites-page-frame viewport-${viewport}${viewport === 'mobile' ? ' product-page-layout-mobile' : ''}`}>
        <div
          className="grid-canvas-container sites-canvas builder-product-canvas"
          onPointerDown={(e) => {
            if (isBuilderEditInteractionTarget(e.target) || isBuilderSectionChromeTarget(e.target)) return;
            onSelectSection(null);
          }}
          onClickCapture={preventBuilderLinkNavigation}
          style={{
            fontFamily: theme.fontFamily || undefined,
            color: theme.textColor || undefined,
            backgroundColor: theme.backgroundColor || '#fff',
            ['--site-primary' as string]: theme.primaryColor || '#1a73e8',
            ...themeVars,
          }}
        >
          {siteSettings ? (
            <StorefrontSiteHeader
              siteSettings={siteSettings}
              preview
              onSelectAnnouncement={() => onSelectSection(SITE_ANNOUNCEMENT_SELECTION_ID)}
              isAnnouncementSelected={isSiteAnnouncementSelected}
              onSelectHeader={() => onSelectSection(SITE_HEADER_SELECTION_ID)}
              isHeaderSelected={isSiteHeaderSelected}
            />
          ) : null}

          <div className="sites-editor-builtin-catalog">
            <div className="sites-builtin-selection-label" aria-hidden>
              Product catalog
            </div>
            <CollectionPageRuntime
              products={products}
              embedded
              columns={settings.columns}
              sectionTitle={category.label}
              showSearch={settings.showSearch}
              showCategoryFilters={settings.showCategoryFilters}
              showSort={settings.showSort}
              viewMode={settings.viewMode}
              cardsStyle={normalizeProductCardStyle(settings.cardsStyle)}
              productImageRatio={settings.productImageRatio}
              showPrice={settings.showPrice}
              showAvailability={settings.showAvailability}
              defaultSorting={settings.defaultSorting}
              builderPreview
              previewCategoryId={previewCategoryId}
              onPreviewCategoryChange={setPreviewCategoryId}
              onBuilderProductClick={onProductPreview}
            />
          </div>

          {siteSettings ? (
            <div
              className={`sites-editor-footer-preview${
                catalogClassicFooter ? ' sites-editor-footer-preview--catalog' : ''
              }${siteSettings.footerWidth === 'full' ? ' sites-editor-footer-preview--full' : ''}${
                isSiteFooterSelected ? ' selected' : ''
              }`}
              role="button"
              tabIndex={0}
              aria-label="Edit site footer"
              aria-pressed={isSiteFooterSelected}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSection(SITE_FOOTER_SELECTION_ID);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectSection(SITE_FOOTER_SELECTION_ID);
                }
              }}
            >
              {isSiteFooterSelected ? (
                <div className="sites-footer-selection-label" onClick={(e) => e.stopPropagation()}>
                  Footer
                </div>
              ) : null}
              <WebsiteFooter siteSettings={siteSettings} previewMode />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
