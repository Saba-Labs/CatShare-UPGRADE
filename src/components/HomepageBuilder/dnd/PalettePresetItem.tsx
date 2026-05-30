import { useDraggable } from '@dnd-kit/core';
import type { IconType } from 'react-icons';
import type { BlockPresetId } from '../../../config/blockPresets';
import { palettePresetDragId, type BuilderDragData } from './builderDndTypes';

interface PalettePresetItemProps {
  presetId: BlockPresetId;
  label: string;
  description: string;
  Icon: IconType;
  onAdd: (presetId: BlockPresetId) => void;
}

export default function PalettePresetItem({
  presetId,
  label,
  description,
  Icon,
  onAdd,
}: PalettePresetItemProps) {
  const id = palettePresetDragId(presetId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { source: 'palette-preset', presetId } satisfies BuilderDragData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`preset-tile${isDragging ? ' preset-tile--dragging' : ''}`}
      title={`${label} — ${description}. Drag to place or click to add.`}
      onClick={() => onAdd(presetId)}
      {...listeners}
      {...attributes}
    >
      <Icon className="preset-tile__icon" aria-hidden />
      <span className="preset-tile__label">{label}</span>
    </button>
  );
}
