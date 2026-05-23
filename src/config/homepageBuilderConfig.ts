import { HomepageSection, HomepageSectionType, ThemeSettings } from '../types/homepage';
import { v4 as uuid } from 'uuid';

export const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#2563EB',
  secondaryColor: '#F3F4F6',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily: 'DM Sans, system-ui, sans-serif',
  accentColor: '#DC2626',
};

export const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  carousel: 'Carousel / Image Slider',
  text: 'Text Box',
  image: 'Image Box',
  banner: 'Banner Section',
  'featured-products': 'Featured Products',
  'category-showcase': 'Category Showcase',
  'product-grid': 'Product Grid',
  announcement: 'Announcement Bar',
  cta: 'Call to Action',
  video: 'Video Section',
  testimonials: 'Testimonials',
  footer: 'Footer',
  'feature-card': 'Feature Card',
  'two-column-content': 'Two-Column Content',
  'content-grid': 'Content Grid',
};

export const SECTION_TYPE_DESCRIPTIONS: Record<HomepageSectionType, string> = {
  carousel: 'Image carousel/slider with navigation controls',
  text: 'Rich text content box',
  image: 'Single image with optional link',
  banner: 'Full-width banner with overlay text and CTA',
  'featured-products': 'Showcase selected products in grid or slider',
  'category-showcase': 'Display store categories as cards',
  'product-grid': 'Product grid with search and filters',
  announcement: 'Important announcements or alerts',
  cta: 'Call-to-action section with button',
  video: 'Embedded video player',
  testimonials: 'Customer testimonials or reviews',
  footer: 'Store footer with links and info',
  'feature-card': 'Image with title and description in a single card layout',
  'two-column-content': 'Flexible two-column layout with text and images',
  'content-grid': 'Multiple feature cards arranged in a responsive grid',
};

export function createDefaultSection(
  type: HomepageSectionType,
  order: number = 0
): HomepageSection & { id: string; order: number } {
  const id = uuid();

  switch (type) {
    case 'carousel':
      return {
        id,
        type: 'carousel',
        order,
        settings: {
          height: 'medium',
          aspectRatio: '16:9',
          autoPlay: true,
          interval: 5000,
          navigation: 'dots',
          animation: 'fade',
        },
        content: {
          images: [],
        },
      } as any;

    case 'text':
      return {
        id,
        type: 'text',
        order,
        settings: {
          alignment: 'left',
          fontSize: 'medium',
          padding: 'medium',
        },
        content: {
          text: 'Enter your text content here...',
        },
      } as any;

    case 'image':
      return {
        id,
        type: 'image',
        order,
        settings: {
          width: 'large',
          alignment: 'center',
          rounded: false,
          shadow: true,
        },
        content: {
          url: '',
          alt: 'Image',
        },
      } as any;

    case 'banner':
      return {
        id,
        type: 'banner',
        order,
        settings: {
          height: 'large',
          backgroundColor: '#2563EB',
          overlayOpacity: 0.3,
          textAlignment: 'center',
        },
        content: {
          title: 'Your Banner Title',
          subtitle: 'Subtitle text goes here',
          buttonText: 'Learn More',
          buttonLink: '#',
        },
      } as any;

    case 'featured-products':
      return {
        id,
        type: 'featured-products',
        order,
        settings: {
          title: 'Featured Products',
          displayMode: 'grid',
          columns: 3,
          itemsPerPage: 6,
          showPrice: true,
          showDescription: false,
        },
        content: {
          productIds: [],
        },
      } as any;

    case 'category-showcase':
      return {
        id,
        type: 'category-showcase',
        order,
        settings: {
          title: 'Shop by Category',
          columns: 3,
          layout: 'grid',
          showCount: true,
        },
        content: {
          categoryIds: [],
        },
      } as any;

    case 'product-grid':
      return {
        id,
        type: 'product-grid',
        order,
        settings: {
          title: 'All Products',
          columns: 3,
          displayMode: 'grid',
          sortBy: 'default',
          itemsToShow: 12,
          showFilters: true,
          showSearch: true,
        },
        content: {
          categoryId: undefined,
          productIds: undefined,
        },
      } as any;

    case 'announcement':
      return {
        id,
        type: 'announcement',
        order,
        settings: {
          backgroundColor: '#FEF3C7',
          textColor: '#92400E',
          icon: 'info',
          dismissible: true,
        },
        content: {
          message: 'Important announcement goes here',
        },
      } as any;

    case 'cta':
      return {
        id,
        type: 'cta',
        order,
        settings: {
          layout: 'single',
          backgroundColor: '#F3F4F6',
          buttonColor: '#2563EB',
          textAlignment: 'center',
        },
        content: {
          title: 'Ready to get started?',
          description: 'Join thousands of happy customers.',
          buttonText: 'Shop Now',
          buttonLink: '/store',
        },
      } as any;

    case 'video':
      return {
        id,
        type: 'video',
        order,
        settings: {
          width: 'large',
          aspectRatio: '16:9',
          autoPlay: false,
          controls: true,
          alignment: 'center',
        },
        content: {
          videoUrl: '',
          posterImage: '',
        },
      } as any;

    case 'testimonials':
      return {
        id,
        type: 'testimonials',
        order,
        settings: {
          title: 'What Our Customers Say',
          displayMode: 'carousel',
          columns: 1,
          showRating: true,
        },
        content: {
          testimonials: [],
        },
      } as any;

    case 'footer':
      return {
        id,
        type: 'footer',
        order,
        settings: {
          backgroundColor: '#1F2937',
          textColor: '#F9FAFB',
          layout: 'multi-column',
        },
        content: {
          company: 'Your Store Name',
          description: 'Your store description',
          links: [
            { title: 'About', url: '/about' },
            { title: 'Contact', url: '/contact' },
          ],
          social: [],
          copyright: `© ${new Date().getFullYear()} Your Store. All rights reserved.`,
        },
      } as any;

    case 'feature-card':
      return {
        id,
        type: 'feature-card',
        order,
        settings: {
          layout: 'image-left',
          imageWidth: 'medium',
          backgroundColor: '#FFFFFF',
          textColor: '#1F2937',
          padding: 'medium',
        },
        content: {
          imageUrl: '',
          title: 'Feature Title',
          description: 'Feature description goes here. Add details about what makes this feature special.',
          buttonText: 'Learn More',
          buttonLink: '#',
        },
      } as any;

    case 'two-column-content':
      return {
        id,
        type: 'two-column-content',
        order,
        settings: {
          columnLayout: 'text-left',
          backgroundColor: '#F9FAFB',
          padding: 'large',
          gap: 'medium',
        },
        content: {
          leftContent: {
            title: 'Left Column Title',
            description: 'Left column description text goes here.',
            imageUrl: '',
          },
          rightContent: {
            title: 'Right Column Title',
            description: 'Right column description text goes here.',
            imageUrl: '',
          },
        },
      } as any;

    case 'content-grid':
      return {
        id,
        type: 'content-grid',
        order,
        settings: {
          title: 'Our Features',
          columns: 3,
          backgroundColor: '#FFFFFF',
          padding: 'large',
          gap: 'medium',
        },
        content: {
          items: [
            {
              id: uuid(),
              imageUrl: '',
              title: 'Feature 1',
              description: 'First feature description',
              link: '#',
            },
            {
              id: uuid(),
              imageUrl: '',
              title: 'Feature 2',
              description: 'Second feature description',
              link: '#',
            },
            {
              id: uuid(),
              imageUrl: '',
              title: 'Feature 3',
              description: 'Third feature description',
              link: '#',
            },
          ],
        },
      } as any;

    default:
      throw new Error(`Unknown section type: ${type}`);
  }
}

export function createEmptyHomepageLayout() {
  return {
    sections: [],
    theme: DEFAULT_THEME,
  };
}

export const SECTION_ORDERING: HomepageSectionType[] = [
  'carousel',
  'announcement',
  'banner',
  'featured-products',
  'category-showcase',
  'product-grid',
  'feature-card',
  'two-column-content',
  'content-grid',
  'text',
  'image',
  'cta',
  'video',
  'testimonials',
  'footer',
];
