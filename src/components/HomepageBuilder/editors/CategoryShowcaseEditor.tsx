import React from 'react';
import { v4 as uuid } from 'uuid';
import { CategoryShowcaseSection, CustomCategoryItem, HomepageSection, WebsiteModeConfig } from '../../../types/homepage';
import CategoryPicker from './catalogue/CategoryPicker';
import MediaPickerButton from '../media/MediaPickerButton';
import StoreLinkPicker from '../StoreLinkPicker';
import SidebarDropdownField from '../SidebarDropdownField';
import { useBuilderCatalogue } from '../catalogue/BuilderCatalogueContext';
import { resolveCategoryShowcaseSettings } from '../../../utils/categoryShowcaseStyles';
import ColorPickerField from '../ColorPickerField';

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
        <SidebarDropdownField
          ariaLabel="Heading alignment"
          value={resolved.titleAlign}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(next) => updateSettings({ titleAlign: next as CategoryShowcaseSection['settings']['titleAlign'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Layout</label>
        <SidebarDropdownField
          ariaLabel="Category layout"
          value={resolved.layout}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List (wide rows)' },
            { value: 'carousel', label: 'Carousel (scroll row)' },
          ]}
          onChange={(next) => updateSettings({ layout: next as CategoryShowcaseSection['settings']['layout'] })}
        />
      </div>

      {showColumnControl && (
        <div className="panel-section">
          <label className="panel-label">{resolved.layout === 'carousel' ? 'Visible tiles' : 'Columns'}</label>
          <SidebarDropdownField
            ariaLabel={resolved.layout === 'carousel' ? 'Visible tiles' : 'Columns'}
            value={String(settings.columns)}
            options={['2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v }))}
            onChange={(next) =>
              updateSettings({ columns: parseInt(next, 10) as CategoryShowcaseSection['settings']['columns'] })
            }
          />
        </div>
      )}

      <div className="panel-section">
        <label className="panel-label">Spacing between tiles</label>
        <SidebarDropdownField
          ariaLabel="Tile gap"
          value={resolved.gap}
          options={[
            { value: 'sm', label: 'Compact' },
            { value: 'md', label: 'Comfortable' },
            { value: 'lg', label: 'Airy' },
          ]}
          onChange={(next) => updateSettings({ gap: next as CategoryShowcaseSection['settings']['gap'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card style</label>
        <SidebarDropdownField
          ariaLabel="Card style"
          value={resolved.cardStyle}
          options={[
            { value: 'minimal', label: 'Minimal (no frame)' },
            { value: 'card', label: 'Card (shadow)' },
            { value: 'bordered', label: 'Bordered' },
            { value: 'overlay', label: 'Image focus' },
          ]}
          onChange={(next) => updateSettings({ cardStyle: next as CategoryShowcaseSection['settings']['cardStyle'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Tile shape</label>
        <SidebarDropdownField
          ariaLabel="Tile shape"
          value={resolved.cardShape}
          options={[
            { value: 'rounded', label: 'Rounded corners' },
            { value: 'sharp', label: 'Square corners' },
            { value: 'pill', label: 'Pill / capsule' },
            { value: 'circle', label: 'Circle image' },
          ]}
          onChange={(next) => updateSettings({ cardShape: next as CategoryShowcaseSection['settings']['cardShape'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Tile size</label>
        <SidebarDropdownField
          ariaLabel="Tile size"
          value={resolved.cardSize}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
            { value: 'xl', label: 'Extra large' },
          ]}
          onChange={(next) => updateSettings({ cardSize: next as CategoryShowcaseSection['settings']['cardSize'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Image proportions</label>
        <SidebarDropdownField
          ariaLabel="Image proportions"
          value={resolved.imageRatio}
          options={[
            { value: '1:1', label: 'Square (1:1)' },
            { value: '4:3', label: 'Landscape (4:3)' },
            { value: '3:4', label: 'Portrait (3:4)' },
            { value: '16:9', label: 'Wide (16:9)' },
            { value: '2:3', label: 'Tall (2:3)' },
          ]}
          onChange={(next) => updateSettings({ imageRatio: next as CategoryShowcaseSection['settings']['imageRatio'] })}
          disabled={resolved.cardShape === 'circle' && resolved.layout !== 'list'}
        />
        {resolved.cardShape === 'circle' && resolved.layout !== 'list' && (
          <p className="catalogue-picker-hint">Circle tiles always use a square image frame.</p>
        )}
      </div>

      <div className="panel-section">
        <label className="panel-label">Image fit</label>
        <SidebarDropdownField
          ariaLabel="Image fit"
          value={resolved.imageFit}
          options={[
            { value: 'cover', label: 'Fill frame (crop)' },
            { value: 'contain', label: 'Fit inside frame' },
          ]}
          onChange={(next) => updateSettings({ imageFit: next as CategoryShowcaseSection['settings']['imageFit'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Category name</label>
        <SidebarDropdownField
          ariaLabel="Category name style"
          value={resolved.labelStyle}
          options={[
            { value: 'below', label: 'Below image' },
            { value: 'overlay', label: 'On image (gradient)' },
          ]}
          onChange={(next) => updateSettings({ labelStyle: next as CategoryShowcaseSection['settings']['labelStyle'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Hover effect</label>
        <SidebarDropdownField
          ariaLabel="Hover effect"
          value={resolved.hoverEffect}
          options={[
            { value: 'lift', label: 'Lift up' },
            { value: 'zoom', label: 'Zoom image' },
            { value: 'border', label: 'Highlight border' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(next) => updateSettings({ hoverEffect: next as CategoryShowcaseSection['settings']['hoverEffect'] })}
        />
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

      <ColorPickerField
        label="Section"
        value={settings.backgroundColor || '#ffffff'}
        onChange={(backgroundColor) => updateSettings({ backgroundColor })}
      />

      <ColorPickerField
        label="Cards"
        value={settings.cardBackground || '#ffffff'}
        onChange={(cardBackground) => updateSettings({ cardBackground })}
      />

      <ColorPickerField
        label="Text"
        value={settings.labelColor || '#111827'}
        defaultValue="#111827"
        onChange={(labelColor) => updateSettings({ labelColor })}
      />

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
