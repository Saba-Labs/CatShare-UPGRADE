import React, { useRef } from 'react';
import { HomepageLayout, HomepageSection, HomepageSectionType } from '../../types/homepage';
import { SortableCanvas } from './SortableCanvas';
import SectionRenderer from './sections/SectionRenderer';

interface BuilderCanvasProps {
  layout: HomepageLayout;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onReorderSections: (sections: (HomepageSection & { id: string; order: number })[]) => void;
}

export default function BuilderCanvas({
  layout,
  selectedSectionId,
  onSelectSection,
  onRemoveSection,
  onDuplicateSection,
  onReorderSections,
}: BuilderCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<{ type: HomepageSectionType; index: number } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const sectionType = e.dataTransfer.getData('sectionType') as HomepageSectionType;
    if (sectionType && VALID_SECTION_TYPES.includes(sectionType)) {
      // Section will be added via component palette
      // This is handled by the parent's onAddSection
    }
  };

  const handleSectionClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelectSection(id);
  };

  const handleCanvasClick = () => {
    onSelectSection(null);
  };

  const handleRemove = (id: string) => {
    onRemoveSection(id);
  };

  const handleDuplicate = (id: string) => {
    onDuplicateSection(id);
  };

  return (
    <div
      ref={canvasRef}
      className="builder-canvas"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleCanvasClick}
    >
      {layout.sections.length === 0 ? (
        <div className="canvas-empty">
          <div className="canvas-empty-card">
            <div className="canvas-empty-icon">＋</div>
            <p className="canvas-empty-title">Start building your homepage</p>
            <p className="canvas-empty-text">Drag components from the left panel or click any section to add it.</p>
          </div>
        </div>
      ) : (
        <SortableCanvas
          sections={layout.sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={handleSectionClick}
          onRemoveSection={handleRemove}
          onDuplicateSection={handleDuplicate}
          onReorderSections={onReorderSections}
        />
      )}
    </div>
  );
}

const VALID_SECTION_TYPES: HomepageSectionType[] = [
  'carousel',
  'text',
  'image',
  'banner',
  'featured-products',
  'category-showcase',
  'product-grid',
  'announcement',
  'cta',
  'video',
  'testimonials',
  'footer',
  'feature-card',
  'two-column-content',
  'content-grid',
];
