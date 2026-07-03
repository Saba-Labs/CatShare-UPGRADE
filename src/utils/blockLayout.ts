import type { CSSProperties } from 'react';
import type { BlockAlign, BlockLayout } from '../types/homepage';

export const MIN_BLOCK_WIDTH = 20;
export const MAX_BLOCK_WIDTH = 100;
export const BLOCK_WIDTH_SNAP = 5;

export const MIN_BLOCK_HEIGHT = 60;
export const MAX_BLOCK_HEIGHT = 2000;
export const BLOCK_HEIGHT_SNAP = 10;

export function clampBlockHeight(value: number): number {
  if (Number.isNaN(value)) return MIN_BLOCK_HEIGHT;
  return Math.min(MAX_BLOCK_HEIGHT, Math.max(MIN_BLOCK_HEIGHT, Math.round(value)));
}

export function snapBlockHeight(value: number): number {
  const snapped = Math.round(value / BLOCK_HEIGHT_SNAP) * BLOCK_HEIGHT_SNAP;
  return clampBlockHeight(snapped);
}

export function clampBlockWidth(value: number): number {
  if (Number.isNaN(value)) return MAX_BLOCK_WIDTH;
  return Math.min(MAX_BLOCK_WIDTH, Math.max(MIN_BLOCK_WIDTH, Math.round(value)));
}

export function snapBlockWidth(value: number): number {
  const snapped = Math.round(value / BLOCK_WIDTH_SNAP) * BLOCK_WIDTH_SNAP;
  return clampBlockWidth(snapped);
}

export function getBlockWidthPercent(blockLayout?: BlockLayout): number {
  return clampBlockWidth(blockLayout?.widthPercent ?? MAX_BLOCK_WIDTH);
}

export function getBlockAlign(blockLayout?: BlockLayout): BlockAlign {
  return blockLayout?.align ?? 'center';
}

/** Style for the row wrapper that positions a block horizontally. */
export function getBlockRowStyle(blockLayout?: BlockLayout): CSSProperties {
  const align = getBlockAlign(blockLayout);
  const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return { display: 'flex', justifyContent, width: '100%' };
}

/** Style for the block itself (its width/height within the row). */
export function getBlockInnerStyle(blockLayout?: BlockLayout): CSSProperties {
  const widthPercent = getBlockWidthPercent(blockLayout);
  const style: CSSProperties = { width: `${widthPercent}%`, maxWidth: '100%' };
  if (blockLayout?.heightPx) {
    style.height = `${clampBlockHeight(blockLayout.heightPx)}px`;
    style.overflow = 'hidden';
  }
  return style;
}

/** Live storefront — width/align only; image blocks keep editor frame height when set. */
export function getBlockInnerStyleForLive(
  blockLayout?: BlockLayout,
  sectionType?: string
): CSSProperties {
  const widthPercent = getBlockWidthPercent(blockLayout);
  const style: CSSProperties = { width: `${widthPercent}%`, maxWidth: '100%' };
  if (sectionType === 'image' && blockLayout?.heightPx) {
    style.height = `${clampBlockHeight(blockLayout.heightPx)}px`;
    style.overflow = 'hidden';
  }
  return style;
}
