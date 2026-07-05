import {
  HomepageSection,
  HomepageSectionType,
  ThemeSettings,
  WebsiteModeConfig,
  HomepageLayout,
  WebsiteSiteSettings,
} from '../types/homepage';
import { syncSiteThemeAcrossPages } from '../utils/websiteSiteTheme';
import { v4 as uuid } from 'uuid';
import { createDefaultFooterLinkColumns } from './footerVariants';
import { normalizeHeaderVariant } from './headerVariants';
import { normalizeStorefrontPath } from '../utils/storefrontHref';
import { normalizeFreeformElementsList } from '../utils/freeformElements';

export const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#1a73e8',
  secondaryColor: '#e8f0fe',
  backgroundColor: '#FFFFFF',
  textColor: '#202124',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  accentColor: '#d93025',
  buttonStyle: 'solid',
};

export const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  carousel: 'Carousel / Image Slider',
  text: 'Text Box',
  image: 'Image Box',
  banner: 'Banner Section',
  'featured-products': 'Featured Products',
  'category-showcase': 'Category Showcase',
  'product-grid': 'Product Grid',
  'full-product-list': 'Full Product List',
  announcement: 'Announcement Bar',
  cta: 'Call to Action',
  video: 'Video Section',
  testimonials: 'Testimonials',
  footer: 'Footer',
  'feature-card': 'Feature Card',
  'two-column-content': 'Two-Column Content',
  'content-grid': 'Content Grid',
  divider: 'Divider',
  faq: 'FAQ',
  embed: 'Embed',
  freeform: 'Design Canvas',
};

/** Canvas selection id for the site-wide footer chrome (not a page section uuid). */
export const SITE_FOOTER_SELECTION_ID = '__site-footer__';

/** Canvas selection id for the site-wide header chrome (not a page section uuid). */
export const SITE_HEADER_SELECTION_ID = '__site-header__';

/** Canvas selection id for the site-wide announcement bar above the header. */
export const SITE_ANNOUNCEMENT_SELECTION_ID = '__site-announcement__';

export const SECTION_TYPE_DESCRIPTIONS: Record<HomepageSectionType, string> = {
  carousel: 'Image carousel/slider with navigation controls',
  text: 'Rich text content box',
  image: 'Single image with optional link',
  banner: 'Full-width banner with overlay text and CTA',
  'featured-products': 'Showcase selected products in grid or slider',
  'category-showcase': 'Display store categories as cards',
  'product-grid': 'Product grid with search and filters',
  'full-product-list': 'Complete store catalog with order-form list and quantity controls',
  announcement: 'Important announcements or alerts',
  cta: 'Call-to-action section with button',
  video: 'Embedded video player',
  testimonials: 'Customer testimonials or reviews',
  footer: 'Store footer with links and info',
  'feature-card': 'Image with title and description in a single card layout',
  'two-column-content': 'Flexible two-column layout with text and images',
  'content-grid': 'Multiple feature cards arranged in a responsive grid',
  divider: 'Horizontal line or spacing between sections',
  faq: 'Expandable questions and answers',
  embed: 'Embed videos, maps, or other iframe content',
  freeform: 'Free-form canvas — place text, images, and buttons anywhere with drag and resize',
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
          verticalAlignment: 'top',
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
          displayMode: 'carousel',
          columns: 3,
          cardStyle: 'boxed',
          cardSize: 'md',
          itemsPerPage: 10,
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
          navigation: 'both',
          cardStyle: 'card',
          cardShape: 'rounded',
          cardSize: 'md',
          imageRatio: '1:1',
          imageFit: 'cover',
          gap: 'md',
          titleAlign: 'left',
          labelStyle: 'below',
          labelAlign: 'left',
          hoverEffect: 'lift',
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
          displayMode: 'carousel',
          cardStyle: 'boxed',
          cardSize: 'md',
          sortBy: 'default',
          itemsToShow: 10,
          showFilters: true,
          showSearch: true,
        },
        content: {
          productSource: 'all',
          categoryId: undefined,
          productIds: [],
        },
      } as any;

    case 'full-product-list':
      return {
        id,
        type: 'full-product-list',
        order,
        settings: {
          title: '',
          showSearch: true,
          showCategoryFilters: true,
          showSort: true,
          viewMode: 'list',
          cardStyle: 'boxed',
          productImageRatio: 'square',
          showPrice: true,
          showAvailability: true,
          defaultSorting: 'newest',
        },
        content: {},
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
          animation: 'none',
          alignment: 'center',
          fontSize: 'medium',
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
          cardStyle: 'classic',
        },
        content: {
          testimonials: [
            {
              id: uuid(),
              text: 'Share what customers love about your products.',
              author: 'Customer name',
              role: 'Verified buyer',
              rating: 5,
            },
          ],
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

    case 'divider':
      return {
        id,
        type: 'divider',
        order,
        settings: {
          style: 'line',
          thickness: 'thin',
          color: '#dadce0',
          width: 'medium',
          spacing: 'medium',
        },
        content: {},
      } as any;

    case 'faq':
      return {
        id,
        type: 'faq',
        order,
        settings: {
          title: 'Frequently asked questions',
          backgroundColor: '#ffffff',
          padding: 'large',
        },
        content: {
          items: [
            {
              id: uuid(),
              question: 'How do I place an order?',
              answer: 'Browse our catalogue, add items to your cart, and checkout via WhatsApp or your preferred method.',
            },
            {
              id: uuid(),
              question: 'What are your delivery times?',
              answer: 'Delivery times vary by location. Contact us for an estimate for your area.',
            },
          ],
        },
      } as any;

    case 'embed':
      return {
        id,
        type: 'embed',
        order,
        settings: {
          aspectRatio: '16:9',
          alignment: 'center',
          maxWidth: 'medium',
        },
        content: {
          embedUrl: '',
          title: '',
        },
      } as any;

    case 'freeform':
      return {
        id,
        type: 'freeform',
        order,
        settings: {
          minHeightPx: 420,
          backgroundColor: '#f1f3f4',
        },
        content: {
          elements: [],
        },
      } as HomepageSection & { id: string; order: number };

    default:
      throw new Error(`Unknown section type: ${type}`);
  }
}

export function createEmptyHomepageLayout() {
  return {
    sections: [],
    theme: DEFAULT_THEME,
    websiteConfig: createDefaultWebsiteModeConfig(),
  };
}

export function createDefaultWebsiteModeConfig(): WebsiteModeConfig {
  return {
    siteSettings: {
      websiteName: 'My Store',
      showAnnouncement: false,
      announcementText: '',
      announcementBg: '#111827',
      announcementTextColor: '#ffffff',
      headerBg: '#ffffff',
      headerTextColor: '#111827',
      headerVariant: 'classic',
      footerVariant: 'classic',
      footerBg: '#ffffff',
      footerTextColor: '#1a1a1a',
      footerColBg: '#f2f2f0',
      footerAccentColor: '#1a6b4a',
      footerAccentBg: '#e8f4ef',
      footerDescription: '',
      footerShowOpenBadge: true,
      footerShowLocation: true,
      footerShowContact: true,
      footerShowStoreInfo: true,
      footerShowFollow: true,
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: [
        { id: uuid(), label: 'Home', href: '/' },
        { id: uuid(), label: 'Collections', href: '/collections/all' },
      ],
    },
    seo: {
      metaTitle: '',
      metaDescription: '',
      keywords: '',
      allowIndexing: true,
    },
    pages: {
      home: {
        sections: [],
        theme: DEFAULT_THEME,
      },
      custom: [],
    },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 4,
        cardsStyle: 'boxed',
        viewMode: 'list',
        productImageRatio: 'square',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        galleryLayout: 'left-thumbs',
        showRecommendations: true,
        imageLook: 'clean',
        fieldsInBox: true,
        suggestedProductsLayout: 'cards',
        suggestedProductsCount: 4,
        showTrustBadges: true,
        ctaStyle: 'solid',
      },
    },
    versioning: {},
  };
}

function normalizeSiteLinkHref(href: string): string {
  return normalizeStorefrontPath(href);
}

function normalizeNavItem(item: import('../types/homepage').WebsiteNavItem): import('../types/homepage').WebsiteNavItem {
  return {
    ...item,
    href: normalizeSiteLinkHref(item.href),
    children: (item.children || []).map(normalizeNavItem),
  };
}

function normalizeSiteSettingsLinks(site: WebsiteSiteSettings): WebsiteSiteSettings {
  return {
    ...site,
    headerVariant: normalizeHeaderVariant(site.headerVariant),
    navItems: (site.navItems || []).map(normalizeNavItem),
    footerColumns: (site.footerColumns || []).map((column) => ({
      ...column,
      links: (column.links || []).map((link) => ({
        ...link,
        href: normalizeSiteLinkHref(link.href),
      })),
    })),
  };
}

export function normalizeHomepageLayoutForWebsiteMode(layout: HomepageLayout): HomepageLayout {
  const baseWebsiteConfig = createDefaultWebsiteModeConfig();
  const normalized: HomepageLayout = {
    ...layout,
    websiteConfig: {
      ...baseWebsiteConfig,
      ...(layout.websiteConfig || {}),
      siteSettings: {
        ...baseWebsiteConfig.siteSettings,
        ...(layout.websiteConfig?.siteSettings || {}),
      },
      seo: {
        ...baseWebsiteConfig.seo,
        ...(layout.websiteConfig?.seo || {}),
      },
      activeTemplateId: layout.websiteConfig?.activeTemplateId,
      pages: {
        home: layout.websiteConfig?.pages?.home || {
          sections: layout.sections || [],
          theme: layout.theme || DEFAULT_THEME,
        },
        custom: (layout.websiteConfig?.pages?.custom || []).map((page) => ({
          ...page,
          slug: page.slug || 'page',
          title: page.title || 'Page',
          layout: {
            sections: page.layout?.sections || [],
            theme: page.layout?.theme || layout.theme || DEFAULT_THEME,
            gridColumns: page.layout?.gridColumns,
            gridGap: page.layout?.gridGap,
          },
        })),
      },
      templates: {
        collection: {
          ...baseWebsiteConfig.templates.collection,
          ...(layout.websiteConfig?.templates?.collection || {}),
        },
        product: {
          ...baseWebsiteConfig.templates.product,
          ...(layout.websiteConfig?.templates?.product || {}),
        },
      },
      versioning: {
        ...(layout.websiteConfig?.versioning || {}),
      },
    },
  };

  if (normalized.websiteConfig) {
    normalized.websiteConfig = syncSiteThemeAcrossPages(normalized.websiteConfig);
    const siteSettings = normalizeSiteSettingsLinks(normalized.websiteConfig.siteSettings);
    if (!siteSettings.footerColumns?.length) {
      siteSettings.footerColumns = createDefaultFooterLinkColumns();
    }
    if (!siteSettings.headerVariant) {
      siteSettings.headerVariant = 'classic';
    }
    normalized.websiteConfig = {
      ...normalized.websiteConfig,
      siteSettings,
    };
    normalized.theme = normalized.websiteConfig.pages.home.theme;
    normalized.websiteConfig = {
      ...normalized.websiteConfig,
      pages: {
        ...normalized.websiteConfig.pages,
        home: {
          ...normalized.websiteConfig.pages.home,
          sections: stripLegacyFooterSections(normalized.websiteConfig.pages.home.sections || []).map(
            normalizeFreeformSectionShape
          ),
        },
        custom: (normalized.websiteConfig.pages.custom || []).map((page) => ({
          ...page,
          layout: {
            ...page.layout,
            sections: stripLegacyFooterSections(page.layout?.sections || []).map(
              normalizeFreeformSectionShape
            ),
          },
        })),
      },
    };
  }

  normalized.sections = stripLegacyFooterSections(normalized.sections || []).map(
    normalizeFreeformSectionShape
  );

  return normalized;
}

/** Ensure saved/partial freeform blocks do not crash the editor or storefront. */
function normalizeFreeformSectionShape<T extends { type: string; content?: unknown; settings?: unknown }>(
  section: T
): T {
  if (section.type !== 'freeform') return section;
  const raw = section as T & {
    content?: { elements?: unknown[] };
    settings?: { minHeightPx?: number; backgroundColor?: string };
  };
  return {
    ...section,
    settings: {
      minHeightPx: raw.settings?.minHeightPx ?? 420,
      backgroundColor: raw.settings?.backgroundColor ?? '#f1f3f4',
      ...raw.settings,
    },
    content: {
      elements: normalizeFreeformElementsList(raw.content?.elements),
    },
  } as T;
}

export const BASIC_SECTION_ORDERING: HomepageSectionType[] = [
  'freeform',
  'text',
  'image',
  'banner',
  'carousel',
  'cta',
  'announcement',
  'video',
  'embed',
  'divider',
  'faq',
  'two-column-content',
  'content-grid',
  'feature-card',
  'testimonials',
];

/** Page sections that must not be inserted — site chrome handles these (e.g. footer). */
export const NON_INSERTABLE_SECTION_TYPES: HomepageSectionType[] = ['footer'];

export function stripLegacyFooterSections<T extends { type: string; order?: number }>(
  sections: T[]
): T[] {
  return sections
    .filter((s) => s.type !== 'footer')
    .map((s, idx) => ({ ...s, order: idx }));
}

export const STORE_SECTION_ORDERING: HomepageSectionType[] = [
  'featured-products',
  'category-showcase',
  'product-grid',
  'full-product-list',
];

export const SECTION_ORDERING: HomepageSectionType[] = [
  ...BASIC_SECTION_ORDERING,
  ...STORE_SECTION_ORDERING,
];
