import React from 'react';
import { HomepageSection, ProductGridSection } from '../../../types/homepage';
import CategoryPicker from './catalogue/CategoryPicker';
import ProductPicker from './catalogue/ProductPicker';
import SidebarDropdownField from '../SidebarDropdownField';
import ProductCardStyleSettingsPanel from './ProductCardStyleSettingsPanel';
import {
  coerceProductSectionDisplayMode,
  getProductCardStyleMeta,
  normalizeProductCardStyle,
  productCardStyleSupportsCarousel,
} from '../../../utils/productCardStyles';

type GridSource = 'all' | 'category' | 'specific';

interface ProductGridEditorProps {
  section: ProductGridSection & { id: string };
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

function currentSource(content: ProductGridSection['content']): GridSource {
  if (content.productSource) return content.productSource;
  if (content.productIds && content.productIds.length > 0) return 'specific';
  if (content.categoryId) return 'category';
  return 'all';
}

export default function ProductGridEditor({ section, onUpdate }: ProductGridEditorProps) {
  const { settings, content } = section;
  const source = currentSource(content);
  const resolvedCardStyle = normalizeProductCardStyle(settings.cardStyle);
  const carouselDisabled = !productCardStyleSupportsCarousel(resolvedCardStyle);
  const effectiveDisplayMode = coerceProductSectionDisplayMode(settings.cardStyle, settings.displayMode);

  const updateSettings = (patch: Partial<ProductGridSection['settings']>) =>
    onUpdate({ settings: { ...settings, ...patch } } as Partial<HomepageSection>);

  const updateContent = (patch: Partial<ProductGridSection['content']>) =>
    onUpdate({ content: { ...content, ...patch } } as Partial<HomepageSection>);

  const setSource = (next: GridSource) => {
    if (next === 'all') {
      updateContent({ productSource: 'all', categoryId: undefined, productIds: [] });
    } else if (next === 'category') {
      updateContent({ productSource: 'category', productIds: [] });
    } else {
      updateContent({ productSource: 'specific', categoryId: undefined, productIds: content.productIds ?? [] });
    }
  };

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Heading</label>
        <input
          type="text"
          className="panel-input"
          value={settings.title}
          onChange={(e) => updateSettings({ title: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Show products from</label>
        <SidebarDropdownField
          ariaLabel="Product source"
          value={source}
          options={[
            { value: 'all', label: 'All products' },
            { value: 'category', label: 'A category' },
            { value: 'specific', label: 'Specific products' },
          ]}
          onChange={(next) => setSource(next as GridSource)}
        />
      </div>

      {source === 'category' && (
        <div className="panel-section">
          <label className="panel-label">Category</label>
          <CategoryPicker
            single
            selectedIds={content.categoryId ? [content.categoryId] : []}
            onChange={(ids) => updateContent({ categoryId: ids[0] })}
          />
        </div>
      )}

      {source === 'specific' && (
        <div className="panel-section">
          <label className="panel-label">Products</label>
          <ProductPicker
            selectedIds={content.productIds || []}
            onChange={(productIds) => updateContent({ productIds })}
          />
        </div>
      )}

      <div className="panel-section">
        <label className="panel-label">Product view</label>
        <SidebarDropdownField
          ariaLabel="Product view mode"
          value={effectiveDisplayMode}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'carousel', label: 'Carousel', disabled: carouselDisabled },
          ]}
          onChange={(next) => updateSettings({ displayMode: next as ProductGridSection['settings']['displayMode'] })}
        />
        {carouselDisabled ? (
          <p className="sidebar-field-hint">
            {`${getProductCardStyleMeta(resolvedCardStyle).label} only works as a grid.`}
          </p>
        ) : null}
      </div>

      <ProductCardStyleSettingsPanel
        cardStyle={settings.cardStyle}
        cardStyleAriaLabel="Product card style"
        displayMode={settings.displayMode}
        onCardStyleChange={(cardStyle, layoutPatch) =>
          updateSettings({
            cardStyle,
            ...(layoutPatch?.displayMode ? { displayMode: layoutPatch.displayMode } : {}),
          })
        }
      />

      {normalizeProductCardStyle(settings.cardStyle) !== 'catalog' ? (
      <div className="panel-section">
        <label className="panel-label">Card size</label>
        <SidebarDropdownField
          ariaLabel="Product grid card size"
          value={settings.cardSize || 'md'}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]}
          onChange={(next) => updateSettings({ cardSize: next as NonNullable<ProductGridSection['settings']['cardSize']> })}
        />
      </div>
      ) : null}

      <div className="panel-section">
        <label className="panel-label">Max products to show</label>
        <input
          type="number"
          min={1}
          max={48}
          className="panel-input"
          value={settings.itemsToShow}
          onChange={(e) => updateSettings({ itemsToShow: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Sort by</label>
        <SidebarDropdownField
          ariaLabel="Sort products"
          value={settings.sortBy}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'alphabetical', label: 'Alphabetical' },
            { value: 'price-low', label: 'Price: Low to High' },
            { value: 'price-high', label: 'Price: High to Low' },
            { value: 'newest', label: 'Newest' },
            { value: 'shuffled', label: 'Shuffled' },
          ]}
          onChange={(next) => updateSettings({ sortBy: next as ProductGridSection['settings']['sortBy'] })}
        />
      </div>
    </>
  );
}
