import { useDroppable } from '@dnd-kit/core';
import { sectionDropId } from './builderDndTypes';

interface SectionDropIndicatorProps {
  index: number;
  expanded: boolean;
}

export default function SectionDropIndicator({ index, expanded }: SectionDropIndicatorProps) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(index) });

  return (
    <div
      ref={setNodeRef}
      className={`sites-drop-slot${expanded ? ' sites-drop-slot--active' : ''}${isOver ? ' sites-drop-slot--over' : ''}`}
      aria-hidden
    />
  );
}
