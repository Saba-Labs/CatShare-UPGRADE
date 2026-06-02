import { WebsiteModeConfig, WebsiteProductTemplate } from '../../types/homepage';
import { getWebsiteTemplate } from '../../config/websiteTemplates';
import SidebarSection from './SidebarSection';
import SidebarDropdownField from './SidebarDropdownField';
import { FiArrowLeft, FiGrid } from './builderSidebarIcons';
import ColorPickerField from './ColorPickerField';

interface ProductTemplateQuickPanelProps {
  productName?: string;
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onBack: () => void;
}

function updateProductTemplate(
  websiteConfig: WebsiteModeConfig,
  patch: Partial<WebsiteProductTemplate>,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  onUpdateWebsiteConfig({
    templates: {
      ...websiteConfig.templates,
      product: { ...websiteConfig.templates.product, ...patch },
    },
  });
}

export default function ProductTemplateQuickPanel({
  productName,
  websiteConfig,
  onUpdateWebsiteConfig,
  onBack,
}: ProductTemplateQuickPanelProps) {
  const product = websiteConfig.templates.product;
  const selectedTemplateTheme = websiteConfig.activeTemplateId
    ? getWebsiteTemplate(websiteConfig.activeTemplateId)?.build().pages.home.theme
    : undefined;
  const baseTheme = selectedTemplateTheme || websiteConfig.pages?.home?.theme || {};
  const paletteDefaults = {
    pageBackground: baseTheme.backgroundColor || '#ffffff',
    surfaceBackground: '#ffffff',
    textPrimary: baseTheme.textColor || '#202124',
    textMuted: '#5f6368',
    borderColor: '#e5e7eb',
    accentColor: baseTheme.primaryColor || '#1a73e8',
    buttonBackground: baseTheme.primaryColor || '#1a73e8',
    buttonText: '#ffffff',
  };
  const colors = { ...paletteDefaults, ...(product.customColors || {}) };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-toolbar">
        <button type="button" className="btn-icon-action sidebar-back-btn" onClick={onBack} title="Back" aria-label="Back">
          <FiArrowLeft aria-hidden />
        </button>
        <div className="sidebar-panel-toolbar__head">
          <FiGrid className="sidebar-panel-toolbar__icon" aria-hidden />
          <h3 className="sidebar-panel-toolbar__title">Product page</h3>
        </div>
      </div>

      <p className="panel-hint" style={{ margin: '0 0 12px' }}>
        {productName
          ? `Layout settings apply to every product page, including “${productName}”.`
          : 'Layout settings apply to every product page on your store.'}
      </p>

      <SidebarSection title="Product page" icon={<FiGrid />} description="Control product page look and feel">
        <div className="panel-section">
          <label className="panel-label">Image look</label>
          <SidebarDropdownField
            ariaLabel="Product image look"
            value={product.imageLook || 'clean'}
            options={[
              { value: 'clean', label: 'Clean' },
              { value: 'soft', label: 'Soft' },
              { value: 'framed', label: 'Framed' },
            ]}
            onChange={(next) =>
              updateProductTemplate(
                websiteConfig,
                { imageLook: next as NonNullable<WebsiteProductTemplate['imageLook']> },
                onUpdateWebsiteConfig
              )
            }
          />
        </div>

        <div className="panel-section">
          <label className="panel-label">Fields area look</label>
          <SidebarDropdownField
            ariaLabel="Product details fields look"
            value={product.fieldsLook || 'plain'}
            options={[
              { value: 'plain', label: 'Plain' },
              { value: 'card', label: 'Card' },
              { value: 'striped', label: 'Striped' },
            ]}
            onChange={(next) =>
              updateProductTemplate(
                websiteConfig,
                { fieldsLook: next as NonNullable<WebsiteProductTemplate['fieldsLook']> },
                onUpdateWebsiteConfig
              )
            }
          />
        </div>

        <div className="panel-section">
          <label className="panel-label">Color theme</label>
          <SidebarDropdownField
            ariaLabel="Product page color theme"
            value={product.colorTheme || 'brand'}
            options={[
              { value: 'brand', label: 'Brand' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'warm', label: 'Warm' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(next) =>
              updateProductTemplate(
                websiteConfig,
                { colorTheme: next as NonNullable<WebsiteProductTemplate['colorTheme']> },
                onUpdateWebsiteConfig
              )
            }
          />
        </div>

        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={product.showRecommendations}
            onChange={(e) =>
              updateProductTemplate(websiteConfig, { showRecommendations: e.target.checked }, onUpdateWebsiteConfig)
            }
          />
          <span>Show suggested products</span>
        </label>

        {product.showRecommendations ? (
          <>
            <div className="panel-section">
              <label className="panel-label">Suggested products layout</label>
              <SidebarDropdownField
                ariaLabel="Suggested products layout"
                value={product.suggestedProductsLayout || 'cards'}
                options={[
                  { value: 'cards', label: 'Cards grid' },
                  { value: 'list', label: 'Compact list' },
                  { value: 'carousel', label: 'Carousel' },
                ]}
                onChange={(next) =>
                  updateProductTemplate(
                    websiteConfig,
                    { suggestedProductsLayout: next as NonNullable<WebsiteProductTemplate['suggestedProductsLayout']> },
                    onUpdateWebsiteConfig
                  )
                }
              />
            </div>
            <div className="panel-section">
              <label className="panel-label">Suggested products count</label>
              <input
                type="number"
                min={2}
                max={12}
                className="panel-input"
                value={product.suggestedProductsCount || 4}
                onChange={(e) =>
                  updateProductTemplate(
                    websiteConfig,
                    { suggestedProductsCount: Math.max(2, Math.min(12, Number(e.target.value) || 4)) },
                    onUpdateWebsiteConfig
                  )
                }
              />
            </div>
          </>
        ) : null}
      </SidebarSection>

      <SidebarSection title="Colors" icon={<FiGrid />} description="Adjust each product-page color area">
        <div className="color-picker-grid">
          <ColorPickerField
            compact
            label="Page background"
            value={colors.pageBackground}
            defaultValue={paletteDefaults.pageBackground}
            onChange={(pageBackground) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), pageBackground } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Surface background"
            value={colors.surfaceBackground}
            defaultValue={paletteDefaults.surfaceBackground}
            onChange={(surfaceBackground) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), surfaceBackground } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Text primary"
            value={colors.textPrimary}
            defaultValue={paletteDefaults.textPrimary}
            onChange={(textPrimary) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), textPrimary } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Text muted"
            value={colors.textMuted}
            defaultValue={paletteDefaults.textMuted}
            onChange={(textMuted) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), textMuted } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Border"
            value={colors.borderColor}
            defaultValue={paletteDefaults.borderColor}
            onChange={(borderColor) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), borderColor } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Accent"
            value={colors.accentColor}
            defaultValue={paletteDefaults.accentColor}
            onChange={(accentColor) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), accentColor } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Button background"
            value={colors.buttonBackground}
            defaultValue={paletteDefaults.buttonBackground}
            onChange={(buttonBackground) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), buttonBackground } }, onUpdateWebsiteConfig)
            }
          />
          <ColorPickerField
            compact
            label="Button text"
            value={colors.buttonText}
            defaultValue={paletteDefaults.buttonText}
            onChange={(buttonText) =>
              updateProductTemplate(websiteConfig, { customColors: { ...(product.customColors || {}), buttonText } }, onUpdateWebsiteConfig)
            }
          />
        </div>
        <div className="panel-section" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              updateProductTemplate(
                websiteConfig,
                {
                  customColors: {
                    pageBackground: paletteDefaults.pageBackground,
                    surfaceBackground: paletteDefaults.surfaceBackground,
                    textPrimary: paletteDefaults.textPrimary,
                    textMuted: paletteDefaults.textMuted,
                    borderColor: paletteDefaults.borderColor,
                    accentColor: paletteDefaults.accentColor,
                    buttonBackground: paletteDefaults.buttonBackground,
                    buttonText: paletteDefaults.buttonText,
                  },
                },
                onUpdateWebsiteConfig
              )
            }
          >
            Reset to selected template colors
          </button>
        </div>
      </SidebarSection>
    </div>
  );
}
