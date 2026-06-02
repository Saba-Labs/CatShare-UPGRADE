import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { Catalogue } from '../../config/catalogueConfig';
import type { WebsiteProductTemplate, ThemeSettings, WebsiteSiteSettings } from '../../types/homepage';
import {
  SITE_ANNOUNCEMENT_SELECTION_ID,
  SITE_FOOTER_SELECTION_ID,
  SITE_HEADER_SELECTION_ID,
} from '../../config/homepageBuilderConfig';
import ProductPageRuntime from '../WebsiteBuilder/pages/ProductPageRuntime';
import WebsiteFooter from '../WebsiteBuilder/WebsiteFooter';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';
import BuilderProductPreviewBridge from './BuilderProductPreviewBridge';
import { buildWebsiteThemeVars } from '../../utils/websiteThemeVars';
import type { ViewportSize } from './BuilderToolbar';

interface BuilderProductPageOverlayProps {
  product: ProductWithCatalogueData;
  template: WebsiteProductTemplate;
  theme: ThemeSettings;
  siteSettings?: WebsiteSiteSettings;
  currencySymbol: string;
  catalogue: Catalogue | null;
  viewport: ViewportSize;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  onClose: () => void;
}

/** Product page preview in the same editor frame as the homepage (header, product, footer). */
export default function BuilderProductPageOverlay({
  product,
  template,
  theme,
  siteSettings,
  currencySymbol,
  catalogue,
  viewport,
  selectedSectionId,
  onSelectSection,
  onClose,
}: BuilderProductPageOverlayProps) {
  const themeVars = buildWebsiteThemeVars(theme);
  const isSiteFooterSelected = selectedSectionId === SITE_FOOTER_SELECTION_ID;
  const isSiteAnnouncementSelected = selectedSectionId === SITE_ANNOUNCEMENT_SELECTION_ID;
  const isSiteHeaderSelected = selectedSectionId === SITE_HEADER_SELECTION_ID;

  return (
    <div className={`builder-product-page-root viewport-${viewport}`}>
      <div className="builder-product-overlay__toolbar">
        <div>
          <p className="builder-product-overlay__eyebrow">Product page</p>
          <p className="builder-product-overlay__title">{product.name}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Back to page
        </button>
      </div>

      <div className={`sites-page-frame viewport-${viewport}`}>
        <div
          className="grid-canvas-container sites-canvas builder-product-canvas"
          onClick={() => onSelectSection(null)}
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

          <BuilderProductPreviewBridge currencySymbol={currencySymbol} catalogue={catalogue}>
            <ProductPageRuntime
              product={product}
              template={template}
              previewMode
              onPreviewClose={onClose}
            />
          </BuilderProductPreviewBridge>

          {siteSettings ? (
            <div
              className={`sites-editor-footer-preview${
                siteSettings.footerWidth === 'full' ? ' sites-editor-footer-preview--full' : ''
              }${isSiteFooterSelected ? ' selected' : ''}`}
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
