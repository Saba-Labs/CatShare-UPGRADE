import type { HomepageSection } from '../types/homepage';
import { headerLayoutForVariant } from '../config/headerVariants';

/** Full-width hero blocks — eligible for immersive overlay when they are the first section. */
const IMMERSIVE_HERO_BLOCK_TYPES = new Set<HomepageSection['type']>(['banner', 'carousel', 'video']);

/** Smaller media blocks — eligible only when they contain visible media. */
const IMMERSIVE_HERO_MEDIA_TYPES = new Set<HomepageSection['type']>(['image', 'feature-card']);

function sectionOrder(section: HomepageSection): number {
  return 'order' in section && typeof section.order === 'number' ? section.order : 0;
}

function freeformHasHeroMedia(section: HomepageSection): boolean {
  if (section.type !== 'freeform') return false;
  const elements = (section.content as { elements?: Array<{ type?: string; content?: { url?: string } }> })
    ?.elements;
  return (elements ?? []).some(
    (element) => element.type === 'image' && Boolean(element.content?.url?.trim())
  );
}

function mediaSectionHasVisibleMedia(section: HomepageSection): boolean {
  switch (section.type) {
    case 'image':
      return Boolean(section.content.url?.trim());
    case 'feature-card':
      return Boolean(section.content.imageUrl?.trim());
    default:
      return false;
  }
}

/** Whether a section can sit under a transparent immersive header. */
export function sectionSupportsImmersiveHeaderOverlay(section: HomepageSection): boolean {
  if (IMMERSIVE_HERO_BLOCK_TYPES.has(section.type)) return true;
  if (IMMERSIVE_HERO_MEDIA_TYPES.has(section.type)) return mediaSectionHasVisibleMedia(section);
  if (section.type === 'freeform') return freeformHasHeroMedia(section);
  return false;
}

/** @deprecated Use sectionSupportsImmersiveHeaderOverlay */
export function sectionHasImmersiveHeroMedia(section: HomepageSection): boolean {
  return sectionSupportsImmersiveHeaderOverlay(section);
}

export function firstHomepageSection(sections: HomepageSection[] | undefined): HomepageSection | null {
  if (!sections?.length) return null;
  return (
    sections
      .map((section, index) => ({ section, index }))
      .sort((a, b) => {
        const orderDiff = sectionOrder(a.section) - sectionOrder(b.section);
        return orderDiff !== 0 ? orderDiff : a.index - b.index;
      })[0]?.section ?? null
  );
}

export function layoutSupportsImmersiveHeaderOverlay(sections: HomepageSection[] | undefined): boolean {
  const first = firstHomepageSection(sections);
  return first ? sectionSupportsImmersiveHeaderOverlay(first) : false;
}

export function homepageUsesImmersiveHeroOverlay(
  headerVariant: string | undefined,
  sections: HomepageSection[] | undefined
): boolean {
  return headerLayoutForVariant(headerVariant) === 'immersive' && layoutSupportsImmersiveHeaderOverlay(sections);
}
