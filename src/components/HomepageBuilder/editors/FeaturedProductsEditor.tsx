import React from 'react';
import { FeaturedProductsSection, HomepageSection } from '../../../types/homepage';
import ProductPicker from './catalogue/ProductPicker';
import SidebarDropdownField from '../SidebarDropdownField';
import { PRODUCT_CARD_STYLE_OPTIONS } from '../../../utils/productCardStyles';

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
        <label className="panel-label">Product view</label>
        <SidebarDropdownField
          ariaLabel="Featured product view mode"
          value={settings.displayMode || 'grid'}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'carousel', label: 'Carousel' },
          ]}
          onChange={(next) => updateSettings({ displayMode: next as FeaturedProductsSection['settings']['displayMode'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card style</label>
        <SidebarDropdownField
          ariaLabel="Featured product card style"
          value={settings.cardStyle || 'boxed'}
          options={PRODUCT_CARD_STYLE_OPTIONS}
          onChange={(next) => updateSettings({ cardStyle: next as NonNullable<FeaturedProductsSection['settings']['cardStyle']> })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card size</label>
        <SidebarDropdownField
          ariaLabel="Featured product card size"
          value={settings.cardSize || 'md'}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]}
          onChange={(next) => updateSettings({ cardSize: next as NonNullable<FeaturedProductsSection['settings']['cardSize']> })}
        />
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
