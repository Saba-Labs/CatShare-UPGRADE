import type { WebsiteCollectionTemplate } from '../../../types/homepage';
import SidebarDropdownField from '../SidebarDropdownField';
import ProductCardStyleSettingsPanel from './ProductCardStyleSettingsPanel';

interface CollectionTemplateEditorProps {
  template: WebsiteCollectionTemplate;
  onUpdate: (patch: Partial<WebsiteCollectionTemplate>) => void;
}

/** Style options for built-in store / category catalog pages. */
export default function CollectionTemplateEditor({
  template,
  onUpdate,
}: CollectionTemplateEditorProps) {
  return (
    <>
      <ProductCardStyleSettingsPanel
        cardStyle={template.cardsStyle}
        cardStyleAriaLabel="Catalog card style"
        showViewMode
        showImageRatio
        showGridColumns
        viewMode={template.viewMode}
        productImageRatio={template.productImageRatio}
        columns={template.columns}
        onCardStyleChange={(cardsStyle, layoutPatch) => onUpdate({ cardsStyle, ...layoutPatch })}
        onViewModeChange={(viewMode) => onUpdate({ viewMode })}
        onProductImageRatioChange={(productImageRatio) => onUpdate({ productImageRatio })}
        onColumnsChange={(columns) => onUpdate({ columns })}
      />

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={template.showPrice ?? true}
            onChange={(e) => onUpdate({ showPrice: e.target.checked })}
          />
          Show product price
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={template.showAvailability ?? true}
            onChange={(e) => onUpdate({ showAvailability: e.target.checked })}
          />
          Show product availability
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label">Default sorting</label>
        <SidebarDropdownField
          ariaLabel="Default product sorting"
          value={template.defaultSorting ?? 'newest'}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'price-low', label: 'Price: low to high' },
            { value: 'price-high', label: 'Price: high to low' },
            { value: 'alphabetical', label: 'Alphabetical' },
          ]}
          onChange={(next) =>
            onUpdate({ defaultSorting: next as WebsiteCollectionTemplate['defaultSorting'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={template.showFilters ?? true}
            onChange={(e) => onUpdate({ showFilters: e.target.checked })}
          />
          Show categories
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={template.showSort ?? true}
            onChange={(e) => onUpdate({ showSort: e.target.checked })}
          />
          Show sort dropdown
        </label>
      </div>
    </>
  );
}
