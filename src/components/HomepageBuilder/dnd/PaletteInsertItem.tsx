import { useDraggable } from '@dnd-kit/core';
import type { IconType } from 'react-icons';
import type { HomepageSectionType } from '../../../types/homepage';
import { paletteSectionDragId, type BuilderDragData } from './builderDndTypes';

interface PaletteInsertItemProps {
  type: HomepageSectionType;
  label: string;
  fullLabel: string;
  Icon: IconType;
  onAdd: (type: HomepageSectionType) => void;
}

export default function PaletteInsertItem({ type, label, fullLabel, Icon, onAdd }: PaletteInsertItemProps) {
  const id = paletteSectionDragId(type);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { source: 'palette-section', sectionType: type } satisfies BuilderDragData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`insert-block${isDragging ? ' insert-block--dragging' : ''}`}
      title={`${fullLabel} — drag to place or click to add`}
      aria-label={fullLabel}
      onClick={() => onAdd(type)}
      {...listeners}
      {...attributes}
    >
      <Icon className="insert-block__icon" aria-hidden />
      <span className="insert-block__label">{label}</span>
    </button>
  );
}
