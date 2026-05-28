import { HomepageSection, HomepageSectionType } from '../types/homepage';

const MEDIA_SECTION_TYPES: HomepageSectionType[] = [
  'image',
  'banner',
  'feature-card',
  'carousel',
  'video',
];

export function sectionSupportsQuickMedia(type: HomepageSectionType): boolean {
  return MEDIA_SECTION_TYPES.includes(type);
}

/** Apply a selected image URL to the primary image field of a section. */
export function applyMediaUrlToSection(
  section: HomepageSection & { id: string },
  url: string
): Partial<HomepageSection> | null {
  switch (section.type) {
    case 'image':
      return { content: { ...section.content, url } };
    case 'banner':
      return { settings: { ...section.settings, backgroundImage: url } };
    case 'feature-card':
      return { content: { ...section.content, imageUrl: url } };
    case 'video':
      return { content: { ...section.content, posterImage: url } };
    default:
      return null;
  }
}
