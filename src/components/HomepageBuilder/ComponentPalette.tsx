import React from 'react';
import { HomepageSectionType } from '../../types/homepage';
import { SECTION_TYPE_LABELS, SECTION_TYPE_DESCRIPTIONS, SECTION_ORDERING } from '../../config/homepageBuilderConfig';

interface ComponentPaletteProps {
  onAddSection: (type: HomepageSectionType) => void;
}

export default function ComponentPalette({ onAddSection }: ComponentPaletteProps) {
  const handleDragStart = (e: React.DragEvent, type: HomepageSectionType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('sectionType', type);
  };

  return (
    <div className="component-palette">
      <div className="palette-header">Components</div>
      <div className="palette-sections">
        {SECTION_ORDERING.map((type) => (
          <div
            key={type}
            className="section-item"
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onClick={() => onAddSection(type)}
            title={`Drag to canvas or click to add ${SECTION_TYPE_LABELS[type]}`}
          >
            <div className="section-item-title">{SECTION_TYPE_LABELS[type]}</div>
            <div className="section-item-desc">{SECTION_TYPE_DESCRIPTIONS[type]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
