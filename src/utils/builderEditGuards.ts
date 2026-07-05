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
  const merged = { ...section, ...updates } as LayoutSection;
  if (updates.settings) {
    merged.settings = {
      ...(section.settings && typeof section.settings === 'object' ? section.settings : {}),
      ...updates.settings,
    } as typeof section.settings;
  }
  if (updates.content) {
    merged.content = {
      ...(section.content && typeof section.content === 'object' ? section.content : {}),
      ...updates.content,
    } as typeof section.content;
  }
  return merged;
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

function eventTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text && target.parentElement) return target.parentElement;
  return null;
}

/** Stop canvas deselect when interacting with inline editor fields. */
export function isBuilderEditInteractionTarget(target: EventTarget | null): boolean {
  const el = eventTargetElement(target);
  if (!el) return false;
  return Boolean(
    el.closest(
      '.sites-inline-editable, [contenteditable="true"], input, textarea, select, button, a, .sidebar-dropdown, .sites-floating-toolbar, .sites-floating-drag-handle, .builder-inline-format-toolbar, .builder-format-toolbar, .builder-format-select, .builder-format-color, .sites-resize-handle, .carousel-section__arrow, .carousel-section__dot, .cat-showcase-scroll__dot, .website-carousel-nav-btn'
    )
  );
}

/** Regions that should keep the current section selection when clicked. */
export function isBuilderSectionChromeTarget(target: EventTarget | null): boolean {
  const el = eventTargetElement(target);
  if (!el) return false;
  return Boolean(
    el.closest(
      '.sites-document-block, .sites-section-drag-grip, .sites-resize-handle, .sites-editor-footer-preview, .storefront-site-header, .sites-editor-header-preview, .builder-product-overlay__toolbar'
    )
  );
}
