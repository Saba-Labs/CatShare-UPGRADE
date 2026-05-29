import type { CarouselImage, HomepageSection, HomepageSectionType } from '../types/homepage';

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

export function sectionSupportsMultiMedia(type: HomepageSectionType): boolean {
  return type === 'carousel';
}

export function createCarouselImagesFromUrls(urls: string[]): CarouselImage[] {
  const base = Date.now();
  return urls.map((url, index) => ({
    id: `img-${base}-${index}`,
    url,
    title: '',
    caption: '',
  }));
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

/** Append multiple images to a carousel section. */
export function applyMediaUrlsToSection(
  section: HomepageSection & { id: string },
  urls: string[]
): Partial<HomepageSection> | null {
  if (urls.length === 0) return null;
  if (section.type === 'carousel') {
    const newSlides = createCarouselImagesFromUrls(urls);
    return {
      content: {
        images: [...section.content.images, ...newSlides],
      },
    };
  }
  if (urls.length === 1) {
    return applyMediaUrlToSection(section, urls[0]);
  }
  return null;
}
