import { HomepageSection, FullProductListSection } from '../../../types/homepage';
import SidebarDropdownField from '../SidebarDropdownField';
import { PRODUCT_CARD_STYLE_OPTIONS } from '../../../utils/productCardStyles';

interface FullProductListEditorProps {
  section: FullProductListSection & { id: string };
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function FullProductListEditor({ section, onUpdate }: FullProductListEditorProps) {
  const { settings } = section;

  const updateSettings = (patch: Partial<FullProductListSection['settings']>) =>
    onUpdate({ settings: { ...settings, ...patch } } as Partial<HomepageSection>);

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Heading (optional)</label>
        <input
          type="text"
          className="panel-input"
          placeholder="Leave empty for no heading"
          value={settings.title ?? ''}
          onChange={(e) => updateSettings({ title: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">View mode</label>
        <SidebarDropdownField
          ariaLabel="Product list view mode"
          value={settings.viewMode ?? 'list'}
          options={[
            { value: 'list', label: 'List' },
            { value: 'grid', label: 'Grid' },
          ]}
          onChange={(next) =>
            updateSettings({ viewMode: next as FullProductListSection['settings']['viewMode'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card style</label>
        <SidebarDropdownField
          ariaLabel="Full product list card style"
          value={settings.cardStyle ?? 'boxed'}
          options={PRODUCT_CARD_STYLE_OPTIONS}
          onChange={(next) =>
            updateSettings({ cardStyle: next as FullProductListSection['settings']['cardStyle'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Product image ratio</label>
        <SidebarDropdownField
          ariaLabel="Product image ratio"
          value={settings.productImageRatio ?? 'square'}
          options={[
            { value: 'square', label: 'Square' },
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          onChange={(next) =>
            updateSettings({
              productImageRatio: next as FullProductListSection['settings']['productImageRatio'],
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={settings.showPrice ?? true}
            onChange={(e) => updateSettings({ showPrice: e.target.checked })}
          />
          Show product price
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={settings.showAvailability ?? true}
            onChange={(e) => updateSettings({ showAvailability: e.target.checked })}
          />
          Show product availability
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label">Default sorting</label>
        <SidebarDropdownField
          ariaLabel="Default product sorting"
          value={settings.defaultSorting ?? 'newest'}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'price-low', label: 'Price: low to high' },
            { value: 'price-high', label: 'Price: high to low' },
            { value: 'alphabetical', label: 'Alphabetical' },
          ]}
          onChange={(next) =>
            updateSettings({ defaultSorting: next as FullProductListSection['settings']['defaultSorting'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={settings.showSearch}
            onChange={(e) => updateSettings({ showSearch: e.target.checked })}
          />
          Show search
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={settings.showCategoryFilters}
            onChange={(e) => updateSettings({ showCategoryFilters: e.target.checked })}
          />
          Show categories
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label panel-label--checkbox">
          <input
            type="checkbox"
            checked={settings.showSort}
            onChange={(e) => updateSettings({ showSort: e.target.checked })}
          />
          Show sort dropdown
        </label>
      </div>

      <p className="panel-hint">
        Optional block for your homepage only. Category and shop pages use the built-in catalog — edit
        those styles from Pages → Shop catalog or by clicking a category tile.
      </p>
    </>
  );
}
