import React from 'react';
import { FeaturedProductsSection, HomepageSection } from '../../../types/homepage';
import ProductPicker from './catalogue/ProductPicker';
import SidebarDropdownField from '../SidebarDropdownField';
import ProductCardStyleSettingsPanel from './ProductCardStyleSettingsPanel';
import {
  coerceProductSectionDisplayMode,
  getProductCardStyleMeta,
  normalizeProductCardStyle,
  productCardStyleSupportsCarousel,
} from '../../../utils/productCardStyles';

interface FeaturedProductsEditorProps {
  section: FeaturedProductsSection & { id: string };
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function FeaturedProductsEditor({ section, onUpdate }: FeaturedProductsEditorProps) {
  const { settings, content } = section;
  const resolvedCardStyle = normalizeProductCardStyle(settings.cardStyle);
  const carouselDisabled = !productCardStyleSupportsCarousel(resolvedCardStyle);
  const effectiveDisplayMode = coerceProductSectionDisplayMode(settings.cardStyle, settings.displayMode);

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
          value={effectiveDisplayMode}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'carousel', label: 'Carousel', disabled: carouselDisabled },
          ]}
          onChange={(next) => updateSettings({ displayMode: next as FeaturedProductsSection['settings']['displayMode'] })}
        />
        {carouselDisabled ? (
          <p className="sidebar-field-hint">
            {`${getProductCardStyleMeta(resolvedCardStyle).label} only works as a grid.`}
          </p>
        ) : null}
      </div>

      <ProductCardStyleSettingsPanel
        cardStyle={settings.cardStyle}
        cardStyleAriaLabel="Featured product card style"
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
      ) : null}

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
