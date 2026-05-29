import React from 'react';
import { FeaturedProductsSection, HomepageSection } from '../../../types/homepage';
import ProductPicker from './catalogue/ProductPicker';

interface FeaturedProductsEditorProps {
  section: FeaturedProductsSection & { id: string };
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function FeaturedProductsEditor({ section, onUpdate }: FeaturedProductsEditorProps) {
  const { settings, content } = section;

  const updateSettings = (patch: Partial<FeaturedProductsSection['settings']>) =>
    onUpdate({ settings: { ...settings, ...patch } } as Partial<HomepageSection>);

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
          max={24}
          className="panel-input"
          value={settings.itemsPerPage}
          onChange={(e) => updateSettings({ itemsPerPage: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={settings.showPrice}
            onChange={(e) => updateSettings({ showPrice: e.target.checked })}
          />
          <span>Show price</span>
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={settings.showDescription}
            onChange={(e) => updateSettings({ showDescription: e.target.checked })}
          />
          <span>Show description</span>
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label">Products from your catalogue</label>
        <ProductPicker
          selectedIds={content.productIds}
          onChange={(productIds) => onUpdate({ content: { ...content, productIds } } as Partial<HomepageSection>)}
        />
      </div>
    </>
  );
}
