import { WebsiteModeConfig, WebsiteProductTemplate } from '../../types/homepage';
import SidebarSection from './SidebarSection';
import SidebarDropdownField from './SidebarDropdownField';
import { FiArrowLeft, FiGrid } from './builderSidebarIcons';

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
          <label className="panel-label">Product details</label>
          <SidebarDropdownField
            ariaLabel="Product details display style"
            value={product.fieldsInBox === false ? 'open' : 'boxed'}
            options={[
              { value: 'boxed', label: 'In a box' },
              { value: 'open', label: 'No box' },
            ]}
            onChange={(next) =>
              updateProductTemplate(
                websiteConfig,
                { fieldsInBox: next === 'boxed' },
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
    </div>
  );
}
