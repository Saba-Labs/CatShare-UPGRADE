import { v4 as uuid } from 'uuid';
import { footerPresetForVariant } from './footerVariants';
import type {
  HomepageLayout,
  HomepageSection,
  ThemeSettings,
  WebsiteModeConfig,
} from '../types/homepage';

function footerLink(label: string, href: string) {
  return { id: uuid(), label, href };
}

export type WebsiteTemplateId = 'aurora-boutique' | 'pulse-tech' | 'clean-market';

export interface WebsiteTemplateMeta {
  id: WebsiteTemplateId;
  name: string;
  tagline: string;
  description: string;
  /** Public path to a preview thumbnail. */
  previewImage: string;
  /** Swatch colors shown on the gallery card. */
  palette: string[];
  build: () => WebsiteModeConfig;
}

type BuilderSection = HomepageLayout['sections'][number];

let orderCounter = 0;
function section(part: HomepageSection, blockLayout?: BuilderSection['blockLayout']): BuilderSection {
  return {
    ...(part as HomepageSection),
    id: uuid(),
    order: orderCounter++,
    ...(blockLayout ? { blockLayout } : {}),
  } as BuilderSection;
}

function resetOrder() {
  orderCounter = 0;
}

function img(id: WebsiteTemplateId, name: string): string {
  return `/templates/${id}/${name}`;
}

/* ------------------------------------------------------------------ */
/* Aurora Boutique — fashion / lifestyle, warm cream + charcoal        */
/* ------------------------------------------------------------------ */

function buildAuroraBoutique(): WebsiteModeConfig {
  resetOrder();
  const theme: ThemeSettings = {
    primaryColor: '#9c6644',
    secondaryColor: '#ede0d4',
    backgroundColor: '#fdfaf6',
    textColor: '#3b3026',
    accentColor: '#b08968',
    fontFamily: "'Playfair Display', Georgia, serif",
    buttonStyle: 'solid',
  };

  const sections: BuilderSection[] = [
    section({
      type: 'banner',
      settings: {
        height: 'large',
        backgroundImage: img('aurora-boutique', 'hero.jpg'),
        backgroundColor: '#3b3026',
        overlayOpacity: 0.35,
        textAlignment: 'center',
      },
      content: {
        title: 'Timeless style, made for you',
        subtitle: 'Curated pieces crafted to last beyond the season.',
        buttonText: 'Shop the collection',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    section({
      type: 'category-showcase',
      settings: { title: 'Shop by category', columns: 3, layout: 'grid', showCount: true },
      content: { categoryIds: [] },
    } as HomepageSection),
    section({
      type: 'featured-products',
      settings: {
        title: 'Featured pieces',
        displayMode: 'grid',
        columns: 3,
        itemsPerPage: 6,
        showPrice: true,
        showDescription: false,
      },
      content: { productIds: [] },
    } as HomepageSection),
    section({
      type: 'feature-card',
      settings: { layout: 'image-left', imageWidth: 'large', padding: 'large', backgroundColor: '#ede0d4', textColor: '#3b3026' },
      content: {
        imageUrl: img('aurora-boutique', 'story.jpg'),
        title: 'Our story',
        description: 'Born from a love of slow fashion, every piece is chosen with intention and made to be worn for years.',
        buttonText: 'Learn more',
        buttonLink: '#',
      },
    } as HomepageSection),
    section({
      type: 'testimonials',
      settings: { title: 'Loved by our customers', displayMode: 'carousel', columns: 1, showRating: true },
      content: {
        testimonials: [
          { id: uuid(), text: 'The quality is unmatched. I get compliments every time I wear it.', author: 'Priya S.', role: 'Verified buyer', rating: 5 },
          { id: uuid(), text: 'Elegant, timeless and worth every penny.', author: 'Aisha K.', role: 'Verified buyer', rating: 5 },
        ],
      },
    } as HomepageSection),
    section({
      type: 'cta',
      settings: { layout: 'single', backgroundColor: '#3b3026', buttonColor: '#b08968', textAlignment: 'center' },
      content: {
        title: 'Join the Aurora circle',
        description: 'Be first to know about new arrivals and members-only offers.',
        buttonText: 'Shop now',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Aurora Boutique',
      showAnnouncement: true,
      announcementText: 'Complimentary shipping on orders over your first purchase',
      announcementBg: '#3b3026',
      announcementTextColor: '#fdfaf6',
      headerBg: '#fdfaf6',
      headerTextColor: '#3b3026',
      ...footerPresetForVariant('aurora'),
      footerDescription: 'Curated fashion with intention. Quality pieces for every season.',
      footerColumns: [
        {
          title: 'Shop',
          links: [
            footerLink('All products', '/collections/all'),
            footerLink('New arrivals', '/collections/all'),
            footerLink('Our story', '#'),
          ],
        },
        {
          title: 'Customer care',
          links: [
            footerLink('Shipping', '#'),
            footerLink('Returns', '#'),
            footerLink('Contact', '#'),
          ],
        },
      ],
      navItems: [
        { id: uuid(), label: 'Home', href: '/' },
        { id: uuid(), label: 'Shop', href: '/collections/all' },
      ],
    },
    seo: { metaTitle: 'Aurora Boutique', metaDescription: 'Timeless, curated fashion.', keywords: '', allowIndexing: true },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: { showFilters: true, showSort: true, columns: 3, cardsStyle: 'minimal' },
      product: {
        layoutVariant: 'editorial',
        galleryLayout: 'stacked',
        showRecommendations: true,
        showTrustBadges: true,
        ctaStyle: 'solid',
        showQuantitySelector: true,
        stickyBuyBar: false,
        orderCtaLabel: 'Order on WhatsApp',
      },
    },
    versioning: {},
  };
}

/* ------------------------------------------------------------------ */
/* Pulse Tech — electronics, dark modern, electric blue                */
/* ------------------------------------------------------------------ */

function buildPulseTech(): WebsiteModeConfig {
  resetOrder();
  const theme: ThemeSettings = {
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    backgroundColor: '#0b1120',
    textColor: '#e2e8f0',
    accentColor: '#22d3ee',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'solid',
  };

  const sections: BuilderSection[] = [
    section({
      type: 'banner',
      settings: {
        height: 'large',
        backgroundImage: img('pulse-tech', 'hero.jpg'),
        backgroundColor: '#0b1120',
        overlayOpacity: 0.5,
        textAlignment: 'left',
      },
      content: {
        title: 'Next-gen tech, delivered',
        subtitle: 'Premium gadgets and accessories at unbeatable prices.',
        buttonText: 'Shop now',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    section({
      type: 'featured-products',
      settings: {
        title: 'Trending now',
        displayMode: 'grid',
        columns: 4,
        itemsPerPage: 8,
        showPrice: true,
        showDescription: false,
        backgroundColor: '#0b1120',
      },
      content: { productIds: [] },
    } as HomepageSection),
    section({
      type: 'content-grid',
      settings: { title: 'Why shop with us', columns: 3, backgroundColor: '#0f172a', padding: 'large', gap: 'medium' },
      content: {
        items: [
          { id: uuid(), imageUrl: img('pulse-tech', 'feature1.jpg'), title: 'Fast delivery', description: 'Get your order at your doorstep, quickly.', link: '#' },
          { id: uuid(), imageUrl: img('pulse-tech', 'feature2.jpg'), title: 'Genuine warranty', description: 'Every product is 100% authentic and warrantied.', link: '#' },
          { id: uuid(), imageUrl: img('pulse-tech', 'feature3.jpg'), title: 'Expert support', description: 'Our team helps you pick the right gear.', link: '#' },
        ],
      },
    } as HomepageSection),
    section({
      type: 'product-grid',
      settings: {
        title: 'All products',
        columns: 4,
        displayMode: 'grid',
        sortBy: 'newest',
        itemsToShow: 12,
        showFilters: true,
        showSearch: true,
        backgroundColor: '#0b1120',
      },
      content: { productSource: 'all', categoryId: undefined, productIds: [] },
    } as HomepageSection),
    section({
      type: 'testimonials',
      settings: { title: 'What customers say', displayMode: 'grid', columns: 3, showRating: true, backgroundColor: '#0f172a' },
      content: {
        testimonials: [
          { id: uuid(), text: 'Lightning-fast delivery and the product is fantastic.', author: 'Rahul M.', role: 'Verified buyer', rating: 5 },
          { id: uuid(), text: 'Best prices I could find anywhere. Highly recommend.', author: 'Sneha T.', role: 'Verified buyer', rating: 4 },
          { id: uuid(), text: 'Support helped me choose the perfect setup.', author: 'Arjun P.', role: 'Verified buyer', rating: 5 },
        ],
      },
    } as HomepageSection),
    section({
      type: 'cta',
      settings: { layout: 'single', backgroundColor: '#2563eb', buttonColor: '#22d3ee', textAlignment: 'center' },
      content: {
        title: 'Upgrade your setup today',
        description: 'Limited-time deals on the latest tech.',
        buttonText: 'Browse deals',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Pulse Tech',
      showAnnouncement: true,
      announcementText: 'Free express shipping this week only',
      announcementBg: '#2563eb',
      announcementTextColor: '#ffffff',
      headerBg: '#0b1120',
      headerTextColor: '#e2e8f0',
      ...footerPresetForVariant('pulse'),
      footerDescription: 'Premium tech gear with fast delivery and real support when you need it.',
      footerColumns: [
        {
          title: 'Products',
          links: [
            footerLink('All gear', '/collections/all'),
            footerLink('Deals', '/collections/all'),
            footerLink('Warranty', '#'),
          ],
        },
        {
          title: 'Support',
          links: [
            footerLink('FAQ', '#'),
            footerLink('Contact', '#'),
            footerLink('Track order', '#'),
          ],
        },
      ],
      navItems: [
        { id: uuid(), label: 'Home', href: '/' },
        { id: uuid(), label: 'Shop', href: '/collections/all' },
      ],
    },
    seo: { metaTitle: 'Pulse Tech', metaDescription: 'Next-gen tech, delivered.', keywords: '', allowIndexing: true },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: { showFilters: true, showSort: true, columns: 4, cardsStyle: 'boxed' },
      product: {
        layoutVariant: 'tech',
        galleryLayout: 'left-thumbs',
        showRecommendations: true,
        showTrustBadges: true,
        ctaStyle: 'solid',
        showQuantitySelector: true,
        stickyBuyBar: true,
        orderCtaLabel: 'Buy now',
      },
    },
    versioning: {},
  };
}

/* ------------------------------------------------------------------ */
/* Clean Market — minimal / general, white + neutral                   */
/* ------------------------------------------------------------------ */

function buildCleanMarket(): WebsiteModeConfig {
  resetOrder();
  const theme: ThemeSettings = {
    primaryColor: '#111827',
    secondaryColor: '#f3f4f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    accentColor: '#2563eb',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'outline',
  };

  const sections: BuilderSection[] = [
    section({
      type: 'banner',
      settings: {
        height: 'medium',
        backgroundImage: img('clean-market', 'hero.jpg'),
        backgroundColor: '#f3f4f6',
        overlayOpacity: 0.2,
        textAlignment: 'center',
      },
      content: {
        title: 'Everything you need, in one place',
        subtitle: 'Quality products, honest prices, no clutter.',
        buttonText: 'Start shopping',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    section({
      type: 'category-showcase',
      settings: { title: 'Browse categories', columns: 4, layout: 'grid', showCount: true },
      content: { categoryIds: [] },
    } as HomepageSection),
    section({
      type: 'product-grid',
      settings: {
        title: 'Shop all',
        columns: 4,
        displayMode: 'grid',
        sortBy: 'default',
        itemsToShow: 12,
        showFilters: false,
        showSearch: true,
      },
      content: { productSource: 'all', categoryId: undefined, productIds: [] },
    } as HomepageSection),
    section({
      type: 'feature-card',
      settings: { layout: 'image-right', imageWidth: 'medium', padding: 'large', backgroundColor: '#f9fafb', textColor: '#1f2937' },
      content: {
        imageUrl: img('clean-market', 'feature.jpg'),
        title: 'Shopping made simple',
        description: 'A clean, fast experience so you can find what you need and check out in seconds.',
        buttonText: 'Explore',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    section({
      type: 'faq',
      settings: { title: 'Frequently asked questions', backgroundColor: '#ffffff', padding: 'large' },
      content: {
        items: [
          { id: uuid(), question: 'How do I place an order?', answer: 'Browse products, pick what you like, and order directly through WhatsApp.' },
          { id: uuid(), question: 'What are your delivery times?', answer: 'Delivery times vary by location. Reach out and we will share an estimate.' },
        ],
      },
    } as HomepageSection),
    section({
      type: 'cta',
      settings: { layout: 'single', backgroundColor: '#111827', buttonColor: '#2563eb', textAlignment: 'center' },
      content: {
        title: 'Ready to shop?',
        description: 'Discover everything our store has to offer.',
        buttonText: 'Shop now',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Clean Market',
      showAnnouncement: false,
      announcementText: '',
      announcementBg: '#111827',
      announcementTextColor: '#ffffff',
      headerBg: '#ffffff',
      headerTextColor: '#111827',
      ...footerPresetForVariant('clean'),
      footerDescription: 'Everything you need, in one place. Simple shopping, honest prices.',
      footerColumns: [
        {
          title: 'Store',
          links: [
            footerLink('Shop all', '/collections/all'),
            footerLink('About', '#'),
          ],
        },
      ],
      navItems: [
        { id: uuid(), label: 'Home', href: '/' },
        { id: uuid(), label: 'Shop', href: '/collections/all' },
      ],
    },
    seo: { metaTitle: 'Clean Market', metaDescription: 'Everything you need, in one place.', keywords: '', allowIndexing: true },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: { showFilters: false, showSort: true, columns: 4, cardsStyle: 'minimal' },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'stacked',
        showRecommendations: false,
        showTrustBadges: true,
        ctaStyle: 'outline',
        showQuantitySelector: true,
        stickyBuyBar: false,
        orderCtaLabel: 'Order on WhatsApp',
      },
    },
    versioning: {},
  };
}

export const WEBSITE_TEMPLATES: WebsiteTemplateMeta[] = [
  {
    id: 'aurora-boutique',
    name: 'Aurora Boutique',
    tagline: 'Fashion & lifestyle',
    description: 'Elegant, editorial layout with a warm palette — perfect for clothing, jewellery and lifestyle brands.',
    previewImage: '/templates/aurora-boutique/preview.jpg',
    palette: ['#9c6644', '#ede0d4', '#3b3026', '#fdfaf6'],
    build: buildAuroraBoutique,
  },
  {
    id: 'pulse-tech',
    name: 'Pulse Tech',
    tagline: 'Electronics & gadgets',
    description: 'Bold, dark, modern storefront with a sticky buy bar — built for tech and electronics stores.',
    previewImage: '/templates/pulse-tech/preview.jpg',
    palette: ['#2563eb', '#22d3ee', '#0b1120', '#e2e8f0'],
    build: buildPulseTech,
  },
  {
    id: 'clean-market',
    name: 'Clean Market',
    tagline: 'Minimal & general',
    description: 'A clean, neutral, distraction-free layout that fits any kind of store.',
    previewImage: '/templates/clean-market/preview.jpg',
    palette: ['#111827', '#2563eb', '#f3f4f6', '#ffffff'],
    build: buildCleanMarket,
  },
];

export function getWebsiteTemplate(id: WebsiteTemplateId): WebsiteTemplateMeta | undefined {
  return WEBSITE_TEMPLATES.find((t) => t.id === id);
}
