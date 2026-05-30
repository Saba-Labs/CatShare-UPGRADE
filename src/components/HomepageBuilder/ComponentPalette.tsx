import { FreeformElementType, HomepageSectionType } from '../../types/homepage';
import {
  SECTION_TYPE_LABELS,
  BASIC_SECTION_ORDERING,
  STORE_SECTION_ORDERING,
} from '../../config/homepageBuilderConfig';
import { BLOCK_PRESETS, BlockPresetId } from '../../config/blockPresets';
import SidebarSection from './SidebarSection';
import { FiLayers, FiGrid, FiShoppingBag, FiMousePointer, FiType, FiImage, PRESET_ICONS, SECTION_ICONS } from './builderSidebarIcons';
import { FiSquare } from 'react-icons/fi';
import PaletteInsertItem from './dnd/PaletteInsertItem';
import PalettePresetItem from './dnd/PalettePresetItem';

interface ComponentPaletteProps {
  onAddSection: (type: HomepageSectionType) => void;
  onAddFreeformElement?: (type: FreeformElementType) => void;
  onAddPreset: (presetId: BlockPresetId) => void;
}

export default function ComponentPalette({ onAddSection, onAddFreeformElement, onAddPreset }: ComponentPaletteProps) {
  return (
    <div className="sidebar-panel insert-panel">
      <SidebarSection title="Layouts" icon={<FiLayers />} description="Drag onto page or tap to add at end">
        <div className="preset-grid">
          {BLOCK_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.id];
            return (
              <PalettePresetItem
                key={preset.id}
                presetId={preset.id}
                label={preset.label}
                description={preset.description}
                Icon={Icon}
                onAdd={onAddPreset}
              />
            );
          })}
        </div>
      </SidebarSection>

      <SidebarSection title="Design canvas" icon={<FiMousePointer />} description="Place text, images, and buttons freely on a canvas">
        <div className="insert-grid insert-grid--labeled">
          <button
            type="button"
            className="insert-block"
            title="Add a design canvas section"
            onClick={() => onAddSection('freeform')}
          >
            <FiMousePointer className="insert-block__icon" aria-hidden />
            <span className="insert-block__label">Canvas</span>
          </button>
          {onAddFreeformElement && (
            <>
              <button
                type="button"
                className="insert-block"
                title="Add text layer (to selected canvas or new canvas)"
                onClick={() => onAddFreeformElement('text')}
              >
                <FiType className="insert-block__icon" aria-hidden />
                <span className="insert-block__label">Text</span>
              </button>
              <button
                type="button"
                className="insert-block"
                title="Add image layer"
                onClick={() => onAddFreeformElement('image')}
              >
                <FiImage className="insert-block__icon" aria-hidden />
                <span className="insert-block__label">Image</span>
              </button>
              <button
                type="button"
                className="insert-block"
                title="Add button layer"
                onClick={() => onAddFreeformElement('button')}
              >
                <FiSquare className="insert-block__icon" aria-hidden />
                <span className="insert-block__label">Button</span>
              </button>
            </>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title="Blocks" icon={<FiGrid />} description="Drag onto page or tap to add at end">
        <div className="insert-chip-row">
          <span className="insert-chip insert-chip--muted">Basic</span>
        </div>
        <div className="insert-grid insert-grid--labeled">
          {BASIC_SECTION_ORDERING.filter((type) => type !== 'freeform').map((type) => (
            <PaletteInsertItem
              key={type}
              type={type}
              label={shortBlockLabel(type)}
              fullLabel={SECTION_TYPE_LABELS[type]}
              Icon={SECTION_ICONS[type] || FiGrid}
              onAdd={onAddSection}
            />
          ))}
        </div>

        <div className="insert-chip-row">
          <span className="insert-chip insert-chip--store">
            <FiShoppingBag aria-hidden />
            Store
          </span>
        </div>
        <div className="insert-grid insert-grid--labeled">
          {STORE_SECTION_ORDERING.map((type) => (
            <PaletteInsertItem
              key={type}
              type={type}
              label={shortBlockLabel(type)}
              fullLabel={SECTION_TYPE_LABELS[type]}
              Icon={SECTION_ICONS[type] || FiGrid}
              onAdd={onAddSection}
            />
          ))}
        </div>
      </SidebarSection>
    </div>
  );
}

function shortBlockLabel(type: HomepageSectionType): string {
  const short: Partial<Record<HomepageSectionType, string>> = {
    carousel: 'Carousel',
    text: 'Text',
    image: 'Image',
    banner: 'Banner',
    'featured-products': 'Featured',
    'category-showcase': 'Categories',
    'product-grid': 'Products',
    announcement: 'Alert',
    cta: 'CTA',
    video: 'Video',
    testimonials: 'Reviews',
    'feature-card': 'Feature',
    'two-column-content': '2 Columns',
    'content-grid': 'Grid',
    divider: 'Divider',
    faq: 'FAQ',
    embed: 'Embed',
  };
  return short[type] ?? SECTION_TYPE_LABELS[type];
}
