import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HomepageSection } from '../../types/homepage';
import SectionRenderer from './sections/SectionRenderer';

interface SortableSectionItemProps {
  section: HomepageSection & { id: string; order: number };
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export default function SortableSectionItem({
  section,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
}: SortableSectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`section-wrapper ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={(e) => onSelect(e, section.id)}
    >
      <div className="section-toolbar">
        <div className="section-chip">{SECTION_LABELS[section.type] || 'Section'}</div>
        <button
          className="section-tool-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(section.id);
          }}
          title="Duplicate section"
        >
          Duplicate
        </button>
        <button
          className="section-tool-btn danger"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Delete this section?')) {
              onRemove(section.id);
            }
          }}
          title="Delete section"
        >
          Delete
        </button>
        <button
          className="section-tool-btn"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{ cursor: 'grab' }}
        >
          Drag
        </button>
      </div>

      <div className="section-shell">
        <SectionRenderer section={section} editMode={true} />
      </div>
    </div>
  );
}

const SECTION_LABELS: Partial<Record<HomepageSection['type'], string>> = {
  text: 'Text',
  image: 'Image',
  banner: 'Banner',
  carousel: 'Carousel',
  'featured-products': 'Featured Products',
  'category-showcase': 'Categories',
  'product-grid': 'Product Grid',
  announcement: 'Announcement',
  cta: 'Call To Action',
  video: 'Video',
  testimonials: 'Testimonials',
  footer: 'Footer',
  'feature-card': 'Feature Card',
  'two-column-content': 'Two Column',
  'content-grid': 'Content Grid',
};
