import React from 'react';
import { v4 as uuid } from 'uuid';
import { CategoryShowcaseSection, CustomCategoryItem, HomepageSection, WebsiteModeConfig } from '../../../types/homepage';
import CategoryPicker from './catalogue/CategoryPicker';
import MediaPickerButton from '../media/MediaPickerButton';
import StoreLinkPicker from '../StoreLinkPicker';
import { useBuilderCatalogue } from '../catalogue/BuilderCatalogueContext';
import { resolveCategoryShowcaseSettings } from '../../../utils/categoryShowcaseStyles';

interface CategoryShowcaseEditorProps {
  section: CategoryShowcaseSection & { id: string };
  storeId: string;
  websiteConfig?: WebsiteModeConfig;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function CategoryShowcaseEditor({ section, storeId, websiteConfig, onUpdate }: CategoryShowcaseEditorProps) {
  const { settings, content } = section;
  const resolved = resolveCategoryShowcaseSettings(settings);
  const { categories } = useBuilderCatalogue();
  const categoryImages = content.categoryImages || {};
  const customCategories = content.customCategories || [];

  const updateSettings = (patch: Partial<CategoryShowcaseSection['settings']>) =>
    onUpdate({ settings: { ...settings, ...patch } } as Partial<HomepageSection>);

  const updateContent = (patch: Partial<CategoryShowcaseSection['content']>) =>
    onUpdate({ content: { ...content, ...patch } } as Partial<HomepageSection>);

  const setCategoryImage = (categoryId: string, url: string) =>
    updateContent({ categoryImages: { ...categoryImages, [categoryId]: url } });

  const selectedDerived = content.categoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const addCustomCategory = () =>
    updateContent({
      customCategories: [...customCategories, { id: uuid(), label: `Category ${customCategories.length + 1}` }],
    });

  const updateCustomCategory = (id: string, patch: Partial<CustomCategoryItem>) =>
    updateContent({
      customCategories: customCategories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const removeCustomCategory = (id: string) =>
    updateContent({ customCategories: customCategories.filter((c) => c.id !== id) });

  const showColumnControl = resolved.layout === 'grid' || resolved.layout === 'carousel';

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
        <label className="panel-label">Heading alignment</label>
        <select
          className="panel-select"
          value={resolved.titleAlign}
          onChange={(e) => updateSettings({ titleAlign: e.target.value as CategoryShowcaseSection['settings']['titleAlign'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Layout</label>
        <select
          className="panel-select"
          value={resolved.layout}
          onChange={(e) => updateSettings({ layout: e.target.value as CategoryShowcaseSection['settings']['layout'] })}
        >
          <option value="grid">Grid</option>
          <option value="list">List (wide rows)</option>
          <option value="carousel">Carousel (scroll row)</option>
        </select>
      </div>

      {showColumnControl && (
        <div className="panel-section">
          <label className="panel-label">{resolved.layout === 'carousel' ? 'Visible tiles' : 'Columns'}</label>
          <select
            className="panel-select"
            value={settings.columns}
            onChange={(e) =>
              updateSettings({ columns: parseInt(e.target.value, 10) as CategoryShowcaseSection['settings']['columns'] })
            }
          >
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </div>
      )}

      <div className="panel-section">
        <label className="panel-label">Spacing between tiles</label>
        <select
          className="panel-select"
          value={resolved.gap}
          onChange={(e) => updateSettings({ gap: e.target.value as CategoryShowcaseSection['settings']['gap'] })}
        >
          <option value="sm">Compact</option>
          <option value="md">Comfortable</option>
          <option value="lg">Airy</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Card style</label>
        <select
          className="panel-select"
          value={resolved.cardStyle}
          onChange={(e) => updateSettings({ cardStyle: e.target.value as CategoryShowcaseSection['settings']['cardStyle'] })}
        >
          <option value="minimal">Minimal (no frame)</option>
          <option value="card">Card (shadow)</option>
          <option value="bordered">Bordered</option>
          <option value="overlay">Image focus</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Tile shape</label>
        <select
          className="panel-select"
          value={resolved.cardShape}
          onChange={(e) => updateSettings({ cardShape: e.target.value as CategoryShowcaseSection['settings']['cardShape'] })}
        >
          <option value="rounded">Rounded corners</option>
          <option value="sharp">Square corners</option>
          <option value="pill">Pill / capsule</option>
          <option value="circle">Circle image</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Tile size</label>
        <select
          className="panel-select"
          value={resolved.cardSize}
          onChange={(e) => updateSettings({ cardSize: e.target.value as CategoryShowcaseSection['settings']['cardSize'] })}
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="xl">Extra large</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Image proportions</label>
        <select
          className="panel-select"
          value={resolved.imageRatio}
          onChange={(e) => updateSettings({ imageRatio: e.target.value as CategoryShowcaseSection['settings']['imageRatio'] })}
          disabled={resolved.cardShape === 'circle' && resolved.layout !== 'list'}
        >
          <option value="1:1">Square (1:1)</option>
          <option value="4:3">Landscape (4:3)</option>
          <option value="3:4">Portrait (3:4)</option>
          <option value="16:9">Wide (16:9)</option>
          <option value="2:3">Tall (2:3)</option>
        </select>
        {resolved.cardShape === 'circle' && resolved.layout !== 'list' && (
          <p className="catalogue-picker-hint">Circle tiles always use a square image frame.</p>
        )}
      </div>

      <div className="panel-section">
        <label className="panel-label">Image fit</label>
        <select
          className="panel-select"
          value={resolved.imageFit}
          onChange={(e) => updateSettings({ imageFit: e.target.value as CategoryShowcaseSection['settings']['imageFit'] })}
        >
          <option value="cover">Fill frame (crop)</option>
          <option value="contain">Fit inside frame</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Category name</label>
        <select
          className="panel-select"
          value={resolved.labelStyle}
          onChange={(e) => updateSettings({ labelStyle: e.target.value as CategoryShowcaseSection['settings']['labelStyle'] })}
        >
          <option value="below">Below image</option>
          <option value="overlay">On image (gradient)</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Hover effect</label>
        <select
          className="panel-select"
          value={resolved.hoverEffect}
          onChange={(e) => updateSettings({ hoverEffect: e.target.value as CategoryShowcaseSection['settings']['hoverEffect'] })}
        >
          <option value="lift">Lift up</option>
          <option value="zoom">Zoom image</option>
          <option value="border">Highlight border</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={settings.showCount}
            onChange={(e) => updateSettings({ showCount: e.target.checked })}
          />
          <span>Show product count</span>
        </label>
      </div>

      <div className="panel-section">
        <label className="panel-label">Section background</label>
        <input
          type="color"
          className="panel-input"
          value={settings.backgroundColor || '#ffffff'}
          onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card background</label>
        <input
          type="color"
          className="panel-input"
          value={settings.cardBackground || '#ffffff'}
          onChange={(e) => updateSettings({ cardBackground: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Text color</label>
        <input
          type="color"
          className="panel-input"
          value={settings.labelColor || '#111827'}
          onChange={(e) => updateSettings({ labelColor: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Categories from your catalogue</label>
        <CategoryPicker
          selectedIds={content.categoryIds}
          onChange={(categoryIds) => updateContent({ categoryIds })}
        />
      </div>

      {selectedDerived.length > 0 && (
        <div className="panel-section">
          <label className="panel-label">Category images</label>
          <p className="catalogue-picker-hint">Set a custom image for each selected category (optional).</p>
          {selectedDerived.map((category) => (
            <div key={category.id} className="category-image-row">
              <span className="category-image-row-label">{category.label}</span>
              <MediaPickerButton
                storeId={storeId}
                assetKey={`${section.id}-cat-${category.id}`}
                label="Image"
                currentUrl={categoryImages[category.id] || category.imageUrl}
                onUrl={(url) => setCategoryImage(category.id, url)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="panel-section">
        <div className="sidebar-panel-header" style={{ padding: 0 }}>
          <label className="panel-label" style={{ margin: 0 }}>
            Custom categories
          </label>
          <button type="button" className="btn-text" onClick={addCustomCategory}>
            + Add
          </button>
        </div>
        <p className="catalogue-picker-hint">
          Add your own category tiles with a custom name, image and optional link.
        </p>
        {customCategories.map((category) => (
          <div key={category.id} className="custom-category-card">
            <div className="custom-category-card-head">
              <input
                type="text"
                className="panel-input"
                placeholder="Category name"
                value={category.label}
                onChange={(e) => updateCustomCategory(category.id, { label: e.target.value })}
              />
              <button
                type="button"
                className="btn-icon-sm danger"
                title="Remove"
                onClick={() => removeCustomCategory(category.id)}
              >
                ×
              </button>
            </div>
            <MediaPickerButton
              storeId={storeId}
              assetKey={`${section.id}-custom-${category.id}`}
              label="Image"
              currentUrl={category.imageUrl}
              onUrl={(url) => updateCustomCategory(category.id, { imageUrl: url })}
            />
            <label className="panel-label" style={{ marginTop: 8 }}>
              Link (optional)
            </label>
            <StoreLinkPicker
              value={category.link || ''}
              websiteConfig={websiteConfig}
              onChange={(link) => updateCustomCategory(category.id, { link })}
            />
          </div>
        ))}
      </div>
    </>
  );
}
