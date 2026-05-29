import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface SortableGridSectionDragHandle {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  isDragging: boolean;
}

interface SortableGridSectionProps {
  id: string;
  children: (drag: SortableGridSectionDragHandle) => React.ReactNode;
}

export default function SortableGridSection({ id, children }: SortableGridSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`sites-block-row${isDragging ? ' is-dragging' : ''}`}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
