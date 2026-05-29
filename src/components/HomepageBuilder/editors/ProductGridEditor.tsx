import React from 'react';
import { HomepageSection, ProductGridSection } from '../../../types/homepage';
import CategoryPicker from './catalogue/CategoryPicker';
import ProductPicker from './catalogue/ProductPicker';

type GridSource = 'all' | 'category' | 'specific';

interface ProductGridEditorProps {
  section: ProductGridSection & { id: string };
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

function currentSource(content: ProductGridSection['content']): GridSource {
  if (content.productIds && content.productIds.length > 0) return 'specific';
  if (content.categoryId) return 'category';
  return 'all';
}

export default function ProductGridEditor({ section, onUpdate }: ProductGridEditorProps) {
  const { settings, content } = section;
  const source = currentSource(content);

  const updateSettings = (patch: Partial<ProductGridSection['settings']>) =>
    onUpdate({ settings: { ...settings, ...patch } } as Partial<HomepageSection>);

  const updateContent = (patch: Partial<ProductGridSection['content']>) =>
    onUpdate({ content: { ...content, ...patch } } as Partial<HomepageSection>);

  const setSource = (next: GridSource) => {
    if (next === 'all') updateContent({ categoryId: undefined, productIds: [] });
    else if (next === 'category') updateContent({ productIds: [] });
    else updateContent({ categoryId: undefined });
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
        <select
          className="panel-select"
          value={source}
          onChange={(e) => setSource(e.target.value as GridSource)}
        >
          <option value="all">All products</option>
          <option value="category">A category</option>
          <option value="specific">Specific products</option>
        </select>
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
        <label className="panel-label">Columns</label>
        <select
          className="panel-select"
          value={settings.columns}
          onChange={(e) => updateSettings({ columns: parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 })}
        >
          <option value="2">2 Columns</option>
          <option value="3">3 Columns</option>
          <option value="4">4 Columns</option>
        </select>
      </div>

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
        <select
          className="panel-select"
          value={settings.sortBy}
          onChange={(e) => updateSettings({ sortBy: e.target.value as ProductGridSection['settings']['sortBy'] })}
        >
          <option value="default">Default</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={settings.showSearch}
            onChange={(e) => updateSettings({ showSearch: e.target.checked })}
          />
          <span>Show search bar</span>
        </label>
      </div>
    </>
  );
}
