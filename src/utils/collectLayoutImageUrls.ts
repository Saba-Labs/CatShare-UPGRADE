import type { HomepageLayout, HomepageSection, WebsiteModeConfig } from '../types/homepage';

function addUrl(set: Set<string>, raw?: string | null): void {
  const url = (raw || '').trim();
  if (!url || url.startsWith('data:')) return;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    set.add(url);
  }
}

function collectFromSections(sections: HomepageSection[] | undefined, into: Set<string>): void {
  if (!sections?.length) return;

  for (const section of sections) {
    const s = section as HomepageSection & {
      settings?: Record<string, unknown>;
      content?: Record<string, unknown>;
    };
    const settings = (s.settings || {}) as { backgroundImage?: string };
    const content = s.content || {};

    addUrl(into, settings.backgroundImage);

    if (s.type === 'freeform') {
      const elements = (content as { elements?: Array<{ type?: string; content?: { url?: string } }> })
        .elements;
      elements?.forEach((el) => {
        if (el.type === 'image') addUrl(into, el.content?.url);
      });
      continue;
    }

    switch (s.type) {
      case 'image':
        addUrl(into, (content as { url?: string }).url);
        break;
      case 'banner':
        break;
      case 'carousel': {
        const images = (content as { images?: Array<{ url?: string }> }).images;
        images?.forEach((img) => addUrl(into, img.url));
        break;
      }
      case 'video':
        addUrl(into, (content as { posterImage?: string }).posterImage);
        break;
      case 'feature-card':
        addUrl(into, (content as { imageUrl?: string }).imageUrl);
        break;
      case 'two-column-content': {
        const left = (content as { leftContent?: { imageUrl?: string } }).leftContent;
        const right = (content as { rightContent?: { imageUrl?: string } }).rightContent;
        addUrl(into, left?.imageUrl);
        addUrl(into, right?.imageUrl);
        break;
      }
      case 'content-grid': {
        const items = (content as { items?: Array<{ imageUrl?: string }> }).items;
        items?.forEach((item) => addUrl(into, item.imageUrl));
        break;
      }
      case 'category-showcase': {
        const categoryImages = (content as { categoryImages?: Record<string, string> }).categoryImages;
        if (categoryImages) {
          Object.values(categoryImages).forEach((u) => addUrl(into, u));
        }
        const custom = (content as { customCategories?: Array<{ imageUrl?: string }> }).customCategories;
        custom?.forEach((c) => addUrl(into, c.imageUrl));
        break;
      }
      case 'testimonials': {
        const testimonials = (content as { testimonials?: Array<{ image?: string }> }).testimonials;
        testimonials?.forEach((t) => addUrl(into, t.image));
        break;
      }
      default:
        break;
    }
  }
}

function collectFromSiteSettings(websiteConfig: WebsiteModeConfig | undefined, into: Set<string>): void {
  if (!websiteConfig) return;
  const site = websiteConfig.siteSettings;
  addUrl(into, site?.logoUrl);
  addUrl(into, websiteConfig.seo?.ogImageUrl);
  addUrl(into, websiteConfig.seo?.faviconUrl);
}

/** Collect every image URL referenced in the site layout (all pages + site settings). */
export function collectLayoutImageUrls(layout: HomepageLayout | null | undefined): string[] {
  const urls = new Set<string>();
  if (!layout) return [];

  collectFromSiteSettings(layout.websiteConfig, urls);

  const wc = layout.websiteConfig;
  if (wc?.pages) {
    collectFromSections(wc.pages.home?.sections as HomepageSection[] | undefined, urls);
    wc.pages.custom?.forEach((page) => {
      collectFromSections(page.layout?.sections as HomepageSection[] | undefined, urls);
    });
  }

  collectFromSections(layout.sections as HomepageSection[] | undefined, urls);

  return Array.from(urls);
}
