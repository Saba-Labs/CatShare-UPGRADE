import { HomepageSection } from '../types/homepage';
import { createDefaultSection } from './homepageBuilderConfig';

export type BlockPresetId = 'hero' | 'about' | 'contact' | 'storefront';

export interface BlockPresetMeta {
  id: BlockPresetId;
  label: string;
  description: string;
}

export const BLOCK_PRESETS: BlockPresetMeta[] = [
  { id: 'hero', label: 'Hero', description: 'Banner + announcement' },
  { id: 'about', label: 'About', description: 'Story + feature card' },
  { id: 'contact', label: 'Contact', description: 'CTA + text' },
  { id: 'storefront', label: 'Storefront', description: 'Products + categories' },
];

export function buildBlockPresetSections(
  presetId: BlockPresetId,
  startOrder: number
): Array<HomepageSection & { id: string; order: number }> {
  switch (presetId) {
    case 'hero': {
      const banner = createDefaultSection('banner', startOrder);
      Object.assign(banner, {
        settings: {
          ...banner.settings,
          height: 'large' as const,
          backgroundColor: '#1a73e8',
          textAlignment: 'center' as const,
        },
        content: {
          title: 'Welcome to our store',
          subtitle: 'Quality products, delivered with care',
          buttonText: 'Shop now',
          buttonLink: '/collections/all',
        },
      });
      const announcement = createDefaultSection('announcement', startOrder + 1);
      Object.assign(announcement, {
        content: { message: 'Free shipping on orders over $50' },
        settings: {
          ...announcement.settings,
          backgroundColor: '#e8f0fe',
          textColor: '#1a73e8',
        },
      });
      return [banner, announcement];
    }
    case 'about': {
      const text = createDefaultSection('text', startOrder);
      Object.assign(text, {
        settings: { ...text.settings, alignment: 'center' as const, fontSize: 'large' as const },
        content: { text: 'Our story\n\nWe started with a simple idea: make shopping easy and enjoyable for everyone.' },
      });
      const card = createDefaultSection('feature-card', startOrder + 1);
      Object.assign(card, {
        content: {
          imageUrl: '',
          title: 'Why choose us',
          description: 'Curated products, fast support, and a smooth checkout experience.',
          buttonText: 'Learn more',
          buttonLink: '#',
        },
      });
      return [text, card];
    }
    case 'contact': {
      const cta = createDefaultSection('cta', startOrder);
      Object.assign(cta, {
        content: {
          title: 'Get in touch',
          description: 'Questions about an order? We are here to help.',
          buttonText: 'Contact us',
          buttonLink: '#',
        },
        settings: { ...cta.settings, textAlignment: 'center' as const },
      });
      const text = createDefaultSection('text', startOrder + 1);
      Object.assign(text, {
        settings: { ...text.settings, alignment: 'center' as const },
        content: { text: 'Email: hello@yourstore.com\nWhatsApp: +1 234 567 8900' },
      });
      return [cta, text];
    }
    case 'storefront': {
      const banner = createDefaultSection('banner', startOrder);
      Object.assign(banner, {
        settings: { ...banner.settings, height: 'medium' as const, backgroundColor: '#0f172a' },
        content: {
          title: 'New arrivals',
          subtitle: 'Browse the latest from our catalogue',
          buttonText: 'View all',
          buttonLink: '/collections/all',
        },
      });
      const products = createDefaultSection('featured-products', startOrder + 1);
      Object.assign(products, {
        settings: { ...products.settings, title: 'Featured products', columns: 3 as const },
      });
      const categories = createDefaultSection('category-showcase', startOrder + 2);
      return [banner, products, categories];
    }
    default:
      return [];
  }
}
