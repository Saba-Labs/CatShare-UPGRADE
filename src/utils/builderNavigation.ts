import type { MouseEvent } from 'react';

/** Block anchor navigation in the homepage editor canvas (links work only on the live site). */
export function preventBuilderLinkNavigation(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a[href]');
  if (!anchor) return;
  event.preventDefault();
}
