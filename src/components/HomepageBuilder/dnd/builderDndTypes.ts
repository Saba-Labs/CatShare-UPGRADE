import type { BlockPresetId } from '../../../config/blockPresets';
import type { HomepageSectionType } from '../../../types/homepage';

export type BuilderDragSource = 'palette-section' | 'palette-preset' | 'canvas-section';

export type BuilderDragData =
  | { source: 'palette-section'; sectionType: HomepageSectionType }
  | { source: 'palette-preset'; presetId: BlockPresetId }
  | { source: 'canvas-section'; sectionId: string };

export function paletteSectionDragId(type: HomepageSectionType): string {
  return `palette-section-${type}`;
}

export function palettePresetDragId(presetId: BlockPresetId): string {
  return `palette-preset-${presetId}`;
}

export function sectionDropId(index: number): string {
  return `drop-${index}`;
}

export function resolveInsertIndex(overId: string, sectionIds: string[]): number {
  if (overId.startsWith('drop-')) {
    const index = parseInt(overId.slice(5), 10);
    return Number.isFinite(index) ? index : sectionIds.length;
  }
  const overSectionIndex = sectionIds.indexOf(overId);
  return overSectionIndex >= 0 ? overSectionIndex : sectionIds.length;
}

export function isPaletteDragId(id: string): boolean {
  return id.startsWith('palette-section-') || id.startsWith('palette-preset-');
}
