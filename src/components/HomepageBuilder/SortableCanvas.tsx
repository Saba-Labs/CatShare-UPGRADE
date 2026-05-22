import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { HomepageSection } from '../../types/homepage';
import SortableSectionItem from './SortableSectionItem';

interface SortableCanvasProps {
  sections: (HomepageSection & { id: string; order: number })[];
  selectedSectionId: string | null;
  onSelectSection: (e: React.MouseEvent, id: string) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onReorderSections: (sections: (HomepageSection & { id: string; order: number })[]) => void;
}

export function SortableCanvas({
  sections,
  selectedSectionId,
  onSelectSection,
  onRemoveSection,
  onDuplicateSection,
  onReorderSections,
}: SortableCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSections = arrayMove(sections, oldIndex, newIndex);
        onReorderSections(newSections);
      }
    }
  };

  const sectionIds = sections.map((s) => s.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="canvas-content">
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SortableSectionItem
              key={section.id}
              section={section}
              isSelected={selectedSectionId === section.id}
              onSelect={onSelectSection}
              onRemove={onRemoveSection}
              onDuplicate={onDuplicateSection}
            />
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
