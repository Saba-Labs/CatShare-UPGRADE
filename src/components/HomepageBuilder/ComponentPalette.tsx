import { HomepageSectionType } from '../../types/homepage';
import {
  SECTION_TYPE_LABELS,
  BASIC_SECTION_ORDERING,
  STORE_SECTION_ORDERING,
} from '../../config/homepageBuilderConfig';
import { BLOCK_PRESETS, BlockPresetId } from '../../config/blockPresets';
import SidebarSection from './SidebarSection';

interface ComponentPaletteProps {
  onAddSection: (type: HomepageSectionType) => void;
  onAddPreset: (presetId: BlockPresetId) => void;
}

export default function ComponentPalette({ onAddSection, onAddPreset }: ComponentPaletteProps) {
  const handleDragStart = (e: React.DragEvent, type: HomepageSectionType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('sectionType', type);
  };

  return (
    <div className="sidebar-panel insert-panel">
      <SidebarSection title="Insert" description="Add layouts or individual blocks to the page.">
        <div className="insert-group-label">Layouts</div>
        <div className="preset-list">
          {BLOCK_PRESETS.map((preset) => (
            <button key={preset.id} type="button" className="preset-row" onClick={() => onAddPreset(preset.id)}>
              <span className="preset-row-label">{preset.label}</span>
              <span className="preset-row-desc">{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="insert-group-label" style={{ marginTop: 14 }}>
          Basic blocks
        </div>
        <div className="insert-grid">
          {BASIC_SECTION_ORDERING.map((type) => (
            <button
              key={type}
              type="button"
              className="insert-block"
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              onClick={() => onAddSection(type)}
              title={SECTION_TYPE_LABELS[type]}
            >
              <span className="insert-block-icon">{SECTION_ICONS[type] || '▣'}</span>
              <span className="insert-block-label">{shortLabel(type)}</span>
            </button>
          ))}
        </div>

        <div className="insert-group-label" style={{ marginTop: 14 }}>
          Store blocks
        </div>
        <div className="insert-grid insert-grid-compact">
          {STORE_SECTION_ORDERING.map((type) => (
            <button
              key={type}
              type="button"
              className="insert-block"
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              onClick={() => onAddSection(type)}
              title={SECTION_TYPE_LABELS[type]}
            >
              <span className="insert-block-icon">{SECTION_ICONS[type] || '▣'}</span>
              <span className="insert-block-label">{shortLabel(type)}</span>
            </button>
          ))}
        </div>
      </SidebarSection>
    </div>
  );
}

function shortLabel(type: HomepageSectionType): string {
  const map: Partial<Record<HomepageSectionType, string>> = {
    'featured-products': 'Featured',
    'category-showcase': 'Categories',
    'product-grid': 'Products',
    'two-column-content': '2 Columns',
    'content-grid': 'Grid',
    'feature-card': 'Feature',
  };
  if (map[type]) return map[type]!;
  const full = SECTION_TYPE_LABELS[type];
  return full.length > 14 ? full.split(' ')[0] : full;
}

const SECTION_ICONS: Partial<Record<HomepageSectionType, string>> = {
  carousel: '▣',
  text: 'T',
  image: '▢',
  banner: '▭',
  'featured-products': '★',
  'category-showcase': '⊞',
  'product-grid': '⊟',
  announcement: '!',
  cta: '→',
  video: '▶',
  testimonials: '❝',
  'feature-card': '◫',
  'two-column-content': '⫴',
  'content-grid': '▦',
  divider: '—',
  faq: '?',
  embed: '⊡',
};
