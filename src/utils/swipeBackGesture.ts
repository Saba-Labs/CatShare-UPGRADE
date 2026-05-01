import type { SwipeEventData } from 'react-swipeable';

/**
 * True when the user performed a deliberate left-edge horizontal back-swipe.
 * Matches manual touch rules on Orders page — avoids diagonal thumb scroll triggering back.
 */
export function isDeliberateEdgeSwipeBack(e: SwipeEventData): boolean {
  const ix = e.initial[0];
  const dx = e.deltaX;
  const dy = e.deltaY;
  const absDy = Math.abs(dy);
  return ix <= 28 && dx > 90 && absDy <= 36 && dx > absDy * 1.8;
}
