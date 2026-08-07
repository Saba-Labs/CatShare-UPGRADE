import { HomepageSection, FullProductListSection } from '../../../types/homepage';
import ProductCardStyleSettingsPanel from './ProductCardStyleSettingsPanel';
import SidebarDropdownField from '../SidebarDropdownField';
import CategoryPicker from './catalogue/CategoryPicker';

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

      <ProductCardStyleSettingsPanel
        cardStyle={settings.cardStyle}
        cardStyleAriaLabel="Full product list card style"
        showViewMode
        showImageRatio
        viewMode={settings.viewMode}
        productImageRatio={settings.productImageRatio}
        onCardStyleChange={(cardStyle, layoutPatch) =>
          updateSettings({ cardStyle, ...layoutPatch })
        }
        onViewModeChange={(viewMode) => updateSettings({ viewMode })}
        onProductImageRatioChange={(productImageRatio) => updateSettings({ productImageRatio })}
      />

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
            { value: 'shuffled', label: 'Shuffled' },
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
            checked={settings.showCategoryFilters}
            onChange={(e) => updateSettings({ showCategoryFilters: e.target.checked })}
          />
          Show categories
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label">Categories to show</label>
        <CategoryPicker
          selectedIds={settings.categoryIds ?? []}
          onChange={(categoryIds) => updateSettings({ categoryIds })}
        />
        <p className="sidebar-field-hint">Leave empty to show all categories.</p>
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
