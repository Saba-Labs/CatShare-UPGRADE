import type { HomepageLayout, HomepageSection, LayoutSection } from '../types/homepage';

export function sectionsShallowEqual(a: HomepageSection, b: HomepageSection): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function mergeSectionUpdate(
  section: LayoutSection,
  updates: Partial<HomepageSection>
): LayoutSection {
  return { ...section, ...updates } as LayoutSection;
}

export function commitInlineText(
  current: string | undefined,
  next: string | undefined,
  commit: (value: string) => void
): void {
  const normalized = (next ?? '').trim();
  if (normalized === (current ?? '').trim()) return;
  commit(normalized);
}

export function layoutsShallowEqual(a: HomepageLayout, b: HomepageLayout): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Stop canvas deselect when interacting with inline editor fields. */
export function isBuilderEditInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      '.sites-inline-editable, [contenteditable="true"], input, textarea, select, button, a, .sidebar-dropdown, .sites-floating-toolbar'
    )
  );
}

/** Regions that should keep the current section selection when clicked. */
export function isBuilderSectionChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      '.sites-document-block, .sites-section-drag-grip, .sites-editor-footer-preview, .storefront-site-header, .sites-editor-header-preview, .builder-product-overlay__toolbar'
    )
  );
}
