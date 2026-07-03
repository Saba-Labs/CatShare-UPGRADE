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
import PanelFieldLabel, { SidebarPanelHeading } from '../PanelFieldLabel';

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

  const showImageShape = resolved.cardShape !== 'circle';

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
          ]}
          onChange={(next) => updateSettings({ titleAlign: next as CategoryShowcaseSection['settings']['titleAlign'] })}
        />
      </div>

      <div className="sidebar-panel-divider" />
      <SidebarPanelHeading title="Layout" />

      <div className="panel-section">
        <PanelFieldLabel
          label="Display"
          hint="Grid wraps to fit the screen. Scroll row is a horizontal strip on all devices."
        />
        <SidebarDropdownField
          ariaLabel="Category display"
          value={resolved.layout === 'carousel' ? 'carousel' : 'grid'}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'carousel', label: 'Scroll row' },
          ]}
          onChange={(next) =>
            updateSettings({ layout: next as 'grid' | 'carousel' })
          }
        />
      </div>

      {resolved.layout === 'carousel' && (
        <div className="panel-section">
          <PanelFieldLabel
            label="Navigation"
            hint="Arrows and dots help visitors scroll when tiles overflow the row."
          />
          <SidebarDropdownField
            ariaLabel="Scroll row navigation"
            value={resolved.navigation}
            options={[
              { value: 'both', label: 'Arrows and dots' },
              { value: 'arrows', label: 'Arrows only' },
              { value: 'dots', label: 'Dots only' },
              { value: 'none', label: 'None (swipe only)' },
            ]}
            onChange={(next) =>
              updateSettings({ navigation: next as CategoryShowcaseSection['settings']['navigation'] })
            }
          />
        </div>
      )}

      <div className="panel-section">
        <PanelFieldLabel
          label="Tile alignment"
          hint="When there are only a few categories, align tiles left, center, or right."
        />
        <SidebarDropdownField
          ariaLabel="Tile alignment"
          value={resolved.tilesAlign}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(next) =>
            updateSettings({ tilesAlign: next as CategoryShowcaseSection['settings']['tilesAlign'] })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Spacing</label>
        <SidebarDropdownField
          ariaLabel="Tile spacing"
          value={resolved.gap}
          options={[
            { value: 'sm', label: 'Compact' },
            { value: 'md', label: 'Comfortable' },
            { value: 'lg', label: 'Wide' },
          ]}
          onChange={(next) => updateSettings({ gap: next as CategoryShowcaseSection['settings']['gap'] })}
        />
      </div>

      <div className="sidebar-panel-divider" />
      <SidebarPanelHeading title="Tile style" />

      <div className="panel-section">
        <PanelFieldLabel
          label="Size"
          hint="Controls tile width and image area. Applies on desktop and mobile."
        />
        <SidebarDropdownField
          ariaLabel="Tile size"
          value={resolved.cardSize}
          options={[
            { value: 'xs', label: 'Extra small' },
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
            { value: 'xl', label: 'Extra large' },
          ]}
          onChange={(next) => updateSettings({ cardSize: next as CategoryShowcaseSection['settings']['cardSize'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Shape</label>
        <SidebarDropdownField
          ariaLabel="Tile shape"
          value={resolved.cardShape}
          options={[
            { value: 'rounded', label: 'Rounded square' },
            { value: 'circle', label: 'Circle' },
          ]}
          onChange={(next) => updateSettings({ cardShape: next as CategoryShowcaseSection['settings']['cardShape'] })}
        />
      </div>

      {showImageShape && (
        <div className="panel-section">
          <label className="panel-label">Image crop</label>
          <SidebarDropdownField
            ariaLabel="Image crop"
            value={
              resolved.imageRatio === '4:3' || resolved.imageRatio === '16:9'
                ? '4:3'
                : resolved.imageRatio === '3:4' || resolved.imageRatio === '2:3'
                  ? '3:4'
                  : '1:1'
            }
            options={[
              { value: '1:1', label: 'Square' },
              { value: '4:3', label: 'Landscape' },
              { value: '3:4', label: 'Portrait' },
            ]}
            onChange={(next) => updateSettings({ imageRatio: next as CategoryShowcaseSection['settings']['imageRatio'] })}
          />
        </div>
      )}

      <div className="panel-section">
        <label className="panel-label">Category name</label>
        <SidebarDropdownField
          ariaLabel="Category name placement"
          value={resolved.labelStyle}
          options={[
            { value: 'below', label: 'Below image' },
            { value: 'overlay', label: 'On image' },
          ]}
          onChange={(next) => updateSettings({ labelStyle: next as CategoryShowcaseSection['settings']['labelStyle'] })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Card frame</label>
        <SidebarDropdownField
          ariaLabel="Card frame"
          value={resolved.cardStyle}
          options={[
            { value: 'card', label: 'Card with shadow' },
            { value: 'minimal', label: 'No frame' },
          ]}
          onChange={(next) => updateSettings({ cardStyle: next as CategoryShowcaseSection['settings']['cardStyle'] })}
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
        label="Background"
        value={settings.backgroundColor || '#ffffff'}
        onChange={(backgroundColor) => updateSettings({ backgroundColor })}
      />

      <div className="sidebar-panel-divider" />
      <SidebarPanelHeading
        title="Categories"
        hint="Pick categories from your catalogue or add custom tiles with their own links."
      />

      <div className="panel-section">
        <PanelFieldLabel
          label="From your catalogue"
          hint="Pick categories to show. Leave empty to auto-list categories from your products."
        />
        <CategoryPicker
          selectedIds={content.categoryIds}
          onChange={(categoryIds) => updateContent({ categoryIds })}
        />
      </div>

      {selectedDerived.length > 0 && (
        <div className="panel-section">
          <PanelFieldLabel
            label="Category images"
            hint="Optional custom image per category."
          />
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
          <PanelFieldLabel
            label="Custom tiles"
            hint="Add links that are not tied to a product category."
          />
          <button type="button" className="btn-text" onClick={addCustomCategory}>
            + Add
          </button>
        </div>
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
