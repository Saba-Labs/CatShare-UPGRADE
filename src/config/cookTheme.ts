import { v4 as uuid } from 'uuid';
import type { HomepageLayout, HomepageSection, ThemeSettings, WebsiteModeConfig } from '../types/homepage';
import { createDefaultFooterLinkColumns, footerPresetForVariant } from './footerVariants';
import { headerVariantForTemplate } from './headerVariants';

export type CookSectionId =
  | 'announcement-bar'
  | 'header'
  | 'hero-banner'
  | 'categories'
  | 'featured-collections'
  | 'flash-sale'
  | 'trending-products'
  | 'promotional-banner'
  | 'best-sellers'
  | 'featured-brands'
  | 'new-arrivals'
  | 'why-choose-us'
  | 'customer-reviews'
  | 'blog-buying-guides'
  | 'newsletter'
  | 'footer';

export interface CookSectionOption {
  id: CookSectionId;
  label: string;
  description: string;
  previewImage: string;
  /** Chrome blocks (announcement, header, footer) are not page sections. */
  kind: 'chrome' | 'section';
}

export const COOK_SECTION_OPTIONS: CookSectionOption[] = [
  {
    id: 'announcement-bar',
    label: 'Announcement Bar',
    description: 'Top strip for promos and shipping offers',
    previewImage: '/cook-theme/flash-sale.svg',
    kind: 'chrome',
  },
  {
    id: 'header',
    label: 'Header',
    description: 'Logo, navigation, and store identity',
    previewImage: '/cook-theme/category.svg',
    kind: 'chrome',
  },
  {
    id: 'hero-banner',
    label: 'Hero Banner',
    description: 'Full-width welcome banner with CTA',
    previewImage: '/cook-theme/hero.svg',
    kind: 'section',
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Browse by category tiles',
    previewImage: '/cook-theme/category.svg',
    kind: 'section',
  },
  {
    id: 'featured-collections',
    label: 'Featured Collections',
    description: 'Highlighted collection cards',
    previewImage: '/cook-theme/category.svg',
    kind: 'section',
  },
  {
    id: 'flash-sale',
    label: 'Flash Sale',
    description: 'Urgency banner for limited offers',
    previewImage: '/cook-theme/flash-sale.svg',
    kind: 'section',
  },
  {
    id: 'trending-products',
    label: 'Trending Products',
    description: 'Popular picks in a product grid',
    previewImage: '/cook-theme/product-orange.svg',
    kind: 'section',
  },
  {
    id: 'promotional-banner',
    label: 'Promotional Banner',
    description: 'Split layout promo with image',
    previewImage: '/cook-theme/promo.svg',
    kind: 'section',
  },
  {
    id: 'best-sellers',
    label: 'Best Sellers',
    description: 'Top-selling products showcase',
    previewImage: '/cook-theme/product-gray.svg',
    kind: 'section',
  },
  {
    id: 'featured-brands',
    label: 'Featured Brands',
    description: 'Partner or brand logo row',
    previewImage: '/cook-theme/brand.svg',
    kind: 'section',
  },
  {
    id: 'new-arrivals',
    label: 'New Arrivals',
    description: 'Latest products grid',
    previewImage: '/cook-theme/product-teal.svg',
    kind: 'section',
  },
  {
    id: 'why-choose-us',
    label: 'Why Choose Us',
    description: 'Trust icons and value props',
    previewImage: '/cook-theme/feature-shipping.svg',
    kind: 'section',
  },
  {
    id: 'customer-reviews',
    label: 'Customer Reviews',
    description: 'Testimonials from happy buyers',
    previewImage: '/cook-theme/feature-support.svg',
    kind: 'section',
  },
  {
    id: 'blog-buying-guides',
    label: 'Blog / Buying Guides',
    description: 'Editorial cards for guides and tips',
    previewImage: '/cook-theme/blog.svg',
    kind: 'section',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Email signup call to action',
    previewImage: '/cook-theme/promo.svg',
    kind: 'section',
  },
  {
    id: 'footer',
    label: 'Footer',
    description: 'Links, contact, and store info',
    previewImage: '/cook-theme/category.svg',
    kind: 'chrome',
  },
];

export const DEFAULT_COOK_SECTIONS: CookSectionId[] = [];

function cookImg(name: string): string {
  return `/cook-theme/${name}`;
}

type BuilderSection = HomepageLayout['sections'][number];

let orderCounter = 0;

function resetOrder() {
  orderCounter = 0;
}

function section(part: HomepageSection): BuilderSection {
  return {
    ...(part as HomepageSection),
    id: uuid(),
    order: orderCounter++,
  } as BuilderSection;
}

function featuredProductsSection(title: string, theme: ThemeSettings, itemsPerPage = 8): BuilderSection {
  return section({
    type: 'featured-products',
    settings: {
      title,
      displayMode: 'grid',
      columns: 4,
      itemsPerPage,
      showPrice: true,
      showDescription: false,
      backgroundColor: theme.backgroundColor,
    },
    content: { productIds: [] },
  } as HomepageSection);
}

function storeCategoryShowcase(title: string, theme: ThemeSettings, columns = 4): BuilderSection {
  return section({
    type: 'category-showcase',
    settings: {
      title,
      columns,
      layout: 'grid',
      showCount: true,
      backgroundColor: theme.backgroundColor,
    },
    content: {
      categoryIds: [],
      customCategories: [],
    },
  } as HomepageSection);
}

function buildSectionForId(id: CookSectionId, theme: ThemeSettings): BuilderSection | null {
  switch (id) {
    case 'hero-banner':
      return section({
        type: 'banner',
        settings: {
          height: 'large',
          backgroundImage: cookImg('hero.svg'),
          backgroundColor: theme.primaryColor,
          overlayOpacity: 0.15,
          textAlignment: 'left',
        },
        content: {
          title: 'Savor every. Last. Bite.',
          subtitle: 'Thoughtfully curated products for everyday living.',
          buttonText: 'Shop all',
          buttonLink: '/collections/all',
        },
      } as HomepageSection);

    case 'categories':
      return storeCategoryShowcase('Shop by category', theme);

    case 'featured-collections':
      return storeCategoryShowcase('Featured collections', theme, 3);

    case 'flash-sale':
      return section({
        type: 'banner',
        settings: {
          height: 'medium',
          backgroundImage: cookImg('flash-sale.svg'),
          backgroundColor: '#1a1a2e',
          overlayOpacity: 0.1,
          textAlignment: 'left',
        },
        content: {
          title: 'Flash sale — up to 40% off',
          subtitle: 'Limited time only. Shop before it ends.',
          buttonText: 'Shop sale',
          buttonLink: '/collections/all',
        },
      } as HomepageSection);

    case 'trending-products':
      return featuredProductsSection('Trending now', theme);

    case 'promotional-banner':
      return section({
        type: 'feature-card',
        settings: {
          layout: 'image-left',
          imageWidth: 'large',
          padding: 'large',
          backgroundColor: theme.secondaryColor,
          textColor: theme.textColor,
        },
        content: {
          imageUrl: cookImg('promo.svg'),
          title: 'Seasonal spotlight',
          description: 'Discover our hand-picked favorites — quality pieces made to last.',
          buttonText: 'Explore',
          buttonLink: '/collections/all',
        },
      } as HomepageSection);

    case 'best-sellers':
      return section({
        type: 'product-grid',
        settings: {
          title: 'Best sellers',
          columns: 4,
          displayMode: 'grid',
          sortBy: 'default',
          itemsToShow: 8,
          showFilters: false,
          showSearch: false,
          backgroundColor: theme.backgroundColor,
        },
        content: { productSource: 'all', categoryId: undefined, productIds: [] },
      } as HomepageSection);

    case 'featured-brands':
      return section({
        type: 'content-grid',
        settings: {
          title: 'Featured brands',
          columns: 4,
          backgroundColor: theme.secondaryColor,
          padding: 'medium',
          gap: 'medium',
        },
        content: {
          items: ['Aurora', 'Northline', 'Studio Co.', 'Craft & Co.'].map((name) => ({
            id: uuid(),
            imageUrl: cookImg('brand.svg'),
            title: name,
            description: 'Partner brand',
            link: '#',
          })),
        },
      } as HomepageSection);

    case 'new-arrivals':
      return section({
        type: 'product-grid',
        settings: {
          title: 'New arrivals',
          columns: 4,
          displayMode: 'grid',
          sortBy: 'newest',
          itemsToShow: 8,
          showFilters: false,
          showSearch: false,
          backgroundColor: theme.backgroundColor,
        },
        content: { productSource: 'all', categoryId: undefined, productIds: [] },
      } as HomepageSection);

    case 'why-choose-us':
      return section({
        type: 'content-grid',
        settings: {
          title: 'Why choose us',
          columns: 3,
          backgroundColor: theme.secondaryColor,
          padding: 'large',
          gap: 'large',
        },
        content: {
          items: [
            {
              id: uuid(),
              imageUrl: cookImg('feature-shipping.svg'),
              title: 'Free shipping',
              description: 'Complimentary delivery on qualifying orders.',
              link: '#',
            },
            {
              id: uuid(),
              imageUrl: cookImg('feature-returns.svg'),
              title: 'Easy returns',
              description: 'Hassle-free returns within 14 days.',
              link: '#',
            },
            {
              id: uuid(),
              imageUrl: cookImg('feature-support.svg'),
              title: 'Dedicated support',
              description: 'Real people ready to help when you need it.',
              link: '#',
            },
          ],
        },
      } as HomepageSection);

    case 'customer-reviews':
      return section({
        type: 'testimonials',
        settings: {
          title: 'What our customers say',
          displayMode: 'carousel',
          columns: 1,
          showRating: true,
          backgroundColor: theme.backgroundColor,
        },
        content: {
          testimonials: [
            {
              id: uuid(),
              text: 'Exactly what I was looking for — clean design, fast delivery, and great quality.',
              author: 'Meera R.',
              role: 'Verified buyer',
              rating: 5,
            },
            {
              id: uuid(),
              text: 'Feels like shopping on a premium brand site. Super smooth experience.',
              author: 'Daniel K.',
              role: 'Verified buyer',
              rating: 5,
            },
            {
              id: uuid(),
              text: 'Beautiful products and thoughtful packaging. Will order again.',
              author: 'Sofia L.',
              role: 'Verified buyer',
              rating: 5,
            },
          ],
        },
      } as HomepageSection);

    case 'blog-buying-guides':
      return section({
        type: 'content-grid',
        settings: {
          title: 'Buying guides & stories',
          columns: 3,
          backgroundColor: theme.backgroundColor,
          padding: 'large',
          gap: 'medium',
        },
        content: {
          items: [
            {
              id: uuid(),
              imageUrl: cookImg('blog.svg'),
              title: 'How to pick the right fit',
              description: 'A quick guide to sizing and fabric choices.',
              link: '#',
            },
            {
              id: uuid(),
              imageUrl: cookImg('blog.svg'),
              title: 'Care tips that last',
              description: 'Keep your favorites looking new longer.',
              link: '#',
            },
            {
              id: uuid(),
              imageUrl: cookImg('blog.svg'),
              title: 'Style essentials',
              description: 'Build a wardrobe that works every day.',
              link: '#',
            },
          ],
        },
      } as HomepageSection);

    case 'newsletter':
      return section({
        type: 'cta',
        settings: {
          layout: 'single',
          backgroundColor: theme.primaryColor,
          buttonColor: theme.backgroundColor,
          textAlignment: 'center',
        },
        content: {
          title: 'Stay in the loop',
          description: 'Be the first to know about new drops, restocks, and exclusive offers.',
          buttonText: 'Join newsletter',
          buttonLink: '#',
        },
      } as HomepageSection);

    default:
      return null;
  }
}

export interface CookThemeInput {
  sections: CookSectionId[];
  theme: ThemeSettings;
  storeName?: string;
}

export function buildCookedWebsiteConfig(input: CookThemeInput): WebsiteModeConfig {
  resetOrder();
  const { sections: selected, theme, storeName = 'My Store' } = input;
  const selectedSet = new Set(selected);

  const pageSections: BuilderSection[] = [];
  for (const option of COOK_SECTION_OPTIONS) {
    if (option.kind !== 'section' || !selectedSet.has(option.id)) continue;
    const built = buildSectionForId(option.id, theme);
    if (built) pageSections.push(built);
  }

  const showAnnouncement = selectedSet.has('announcement-bar');
  const showHeader = selectedSet.has('header');
  const showFooter = selectedSet.has('footer');

  const footerPreset = footerPresetForVariant('clean');

  return {
    siteSettings: {
      websiteName: storeName,
      showAnnouncement,
      announcementText: showAnnouncement ? 'Free shipping on orders above your store minimum' : '',
      announcementBg: theme.primaryColor,
      announcementTextColor: '#ffffff',
      headerBg: showHeader ? theme.backgroundColor : '#ffffff',
      headerTextColor: showHeader ? theme.textColor : '#111827',
      headerVariant: showHeader ? headerVariantForTemplate('studio-commerce') : 'minimal',
      ...(showFooter ? footerPreset : footerPresetForVariant('clean')),
      footerDescription: showFooter
        ? 'Modern essentials, thoughtfully made. Quality products with a shopping experience you can trust.'
        : '',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: showHeader
        ? [
            { id: uuid(), label: 'Home', href: '/' },
            { id: uuid(), label: 'Shop', href: '/collections/all' },
            { id: uuid(), label: 'Collections', href: '/collections/all' },
          ]
        : [{ id: uuid(), label: 'Home', href: '/' }],
    },
    seo: {
      metaTitle: storeName,
      metaDescription: `${storeName} — shop our curated collection.`,
      keywords: '',
      allowIndexing: true,
    },
    pages: {
      home: { sections: pageSections, theme: { ...theme } },
      custom: [],
    },
    templates: {
      collection: { showFilters: true, showSort: true, columns: 4, cardsStyle: 'minimal' },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'left-thumbs',
        showRecommendations: true,
        showTrustBadges: true,
        ctaStyle: theme.buttonStyle === 'outline' ? 'outline' : 'solid',
        showQuantitySelector: true,
        stickyBuyBar: true,
        orderCtaLabel: 'Add to order',
      },
    },
    versioning: {},
  };
}
