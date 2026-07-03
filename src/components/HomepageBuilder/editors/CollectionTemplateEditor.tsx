import type { WebsiteCollectionTemplate } from '../../../types/homepage';
import SidebarDropdownField from '../SidebarDropdownField';
import { PRODUCT_CARD_STYLE_OPTIONS } from '../../../utils/productCardStyles';

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
      <div className="panel-section">
        <label className="panel-label">View mode</label>
        <SidebarDropdownField
          ariaLabel="Catalog view mode"
          value={template.viewMode ?? 'list'}
          options={[
            { value: 'list', label: 'List' },
            { value: 'grid', label: 'Grid' },
          ]}
          onChange={(next) =>
            onUpdate({ viewMode: next as WebsiteCollectionTemplate['viewMode'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card style</label>
        <SidebarDropdownField
          ariaLabel="Catalog card style"
          value={template.cardsStyle ?? 'boxed'}
          options={PRODUCT_CARD_STYLE_OPTIONS}
          onChange={(next) =>
            onUpdate({ cardsStyle: next as WebsiteCollectionTemplate['cardsStyle'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Product image ratio</label>
        <SidebarDropdownField
          ariaLabel="Product image ratio"
          value={template.productImageRatio ?? 'square'}
          options={[
            { value: 'square', label: 'Square' },
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          onChange={(next) =>
            onUpdate({
              productImageRatio: next as WebsiteCollectionTemplate['productImageRatio'],
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Grid columns (desktop)</label>
        <SidebarDropdownField
          ariaLabel="Catalog grid columns"
          value={String(template.columns ?? 4)}
          options={[
            { value: '2', label: '2 columns' },
            { value: '3', label: '3 columns' },
            { value: '4', label: '4 columns' },
          ]}
          onChange={(next) =>
            onUpdate({ columns: Number(next) as WebsiteCollectionTemplate['columns'] })
          }
        />
      </div>

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
            checked={template.showSearch ?? true}
            onChange={(e) => onUpdate({ showSearch: e.target.checked })}
          />
          Show search
        </label>
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
