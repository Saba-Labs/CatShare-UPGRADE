import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BlockPresetId } from '../../../config/blockPresets';
import { SECTION_TYPE_LABELS } from '../../../config/homepageBuilderConfig';
import type { HomepageSection, HomepageSectionType } from '../../../types/homepage';
import { BLOCK_PRESETS } from '../../../config/blockPresets';
import {
  type BuilderDragData,
  isPaletteDragId,
  resolveInsertIndex,
} from './builderDndTypes';

interface BuilderDndProviderProps {
  children: React.ReactNode;
  sections: HomepageSection[];
  onInsertSectionAt: (type: HomepageSectionType, index: number) => void;
  onInsertPresetAt: (presetId: BlockPresetId, index: number) => void;
  onReorderSections: (sections: HomepageSection[]) => void;
}

export default function BuilderDndProvider({
  children,
  sections,
  onInsertSectionAt,
  onInsertPresetAt,
  onReorderSections,
}: BuilderDndProviderProps) {
  const [activeDrag, setActiveDrag] = useState<BuilderDragData | null>(null);

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [sections]
  );
  const sectionIds = useMemo(() => sortedSections.map((s) => s.id), [sortedSections]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as BuilderDragData | undefined;
    setActiveDrag(data ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeData = active.data.current as BuilderDragData | undefined;

      if (activeData?.source === 'palette-section') {
        onInsertSectionAt(activeData.sectionType, resolveInsertIndex(overId, sectionIds));
        return;
      }

      if (activeData?.source === 'palette-preset') {
        onInsertPresetAt(activeData.presetId, resolveInsertIndex(overId, sectionIds));
        return;
      }

      if (isPaletteDragId(activeId)) return;

      const oldIndex = sectionIds.indexOf(activeId);
      const newIndex = overId.startsWith('drop-')
        ? resolveInsertIndex(overId, sectionIds)
        : sectionIds.indexOf(overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      onReorderSections(arrayMove(sortedSections, oldIndex, newIndex));
    },
    [onInsertPresetAt, onInsertSectionAt, onReorderSections, sectionIds, sortedSections]
  );

  const handleDragCancel = useCallback(() => setActiveDrag(null), []);

  const overlayLabel = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.source === 'palette-section') {
      return SECTION_TYPE_LABELS[activeDrag.sectionType];
    }
    if (activeDrag.source === 'palette-preset') {
      return BLOCK_PRESETS.find((p) => p.id === activeDrag.presetId)?.label ?? 'Layout';
    }
    if (activeDrag.source === 'canvas-section') {
      const section = sortedSections.find((s) => s.id === activeDrag.sectionId);
      return section ? SECTION_TYPE_LABELS[section.type] : 'Block';
    }
    return 'Block';
  }, [activeDrag, sortedSections]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
        {overlayLabel ? (
          <div className="sites-drag-overlay" role="status">
            {overlayLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
