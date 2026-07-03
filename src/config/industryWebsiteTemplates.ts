import { v4 as uuid } from 'uuid';
import { createDefaultFooterLinkColumns, footerPresetForVariant } from './footerVariants';
import { headerVariantForTemplate } from './headerVariants';
import {
  navHomeShop,
  resetTemplateSectionOrder,
  templateImg,
  templateSection,
} from './templateBuilderUtils';
import type { HomepageSection, ThemeSettings, WebsiteModeConfig } from '../types/homepage';
import type { WebsiteTemplateId } from './websiteTemplateIds';

export type TemplateIndustry = 'fashion' | 'jewellery';

export interface IndustryWebsiteTemplateMeta {
  id: WebsiteTemplateId;
  name: string;
  tagline: string;
  description: string;
  previewImage: string;
  palette: string[];
  industry: TemplateIndustry;
  /** Style bucket for merchants browsing themes. */
  style: 'catalog' | 'subtle' | 'modern' | 'traditional';
  build: () => WebsiteModeConfig;
}

function img(id: string, name: string) {
  return templateImg(id, name);
}

/* ================================================================== */
/* FASHION RESELLER — dresses & occasion wear                         */
/* ================================================================== */

/** Basic catalog #1 — list order form, ideal for WhatsApp resellers. */
function buildFashionWardrobe(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'fashion-wardrobe';
  const theme: ThemeSettings = {
    primaryColor: '#9f1239',
    secondaryColor: '#fce7f3',
    backgroundColor: '#faf8f6',
    textColor: '#1c1917',
    accentColor: '#9f1239',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    headingFontFamily: "'DM Serif Display', Georgia, serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'full-product-list',
      settings: {
        title: '',
        showSearch: true,
        showCategoryFilters: true,
        showSort: true,
        viewMode: 'list',
        cardStyle: 'boxed',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      content: {},
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Wardrobe Resale',
      showAnnouncement: true,
      announcementText: 'Size chart on every listing — message us for fit advice',
      announcementBg: '#9f1239',
      announcementTextColor: '#ffffff',
      headerBg: '#faf8f6',
      headerTextColor: '#1c1917',
      headerVariant: headerVariantForTemplate(id),
      headerTagline: 'Pre-loved & new dresses — honest prices, fast replies.',
      footerBg: '#ffffff',
      footerTextColor: '#1c1917',
      footerAccentColor: '#9f1239',
      footerAccentBg: '#fce7f3',
      footerWidth: 'boxed',
      ...footerPresetForVariant('classic'),
      footerDescription: 'Trusted dress reseller — clear photos, real measurements, easy ordering.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Wardrobe Resale — Dresses & occasion wear',
      metaDescription: 'Browse dresses with sizes, prices, and instant WhatsApp ordering.',
      keywords: 'dresses, resale, fashion, occasion wear',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 3,
        cardsStyle: 'boxed',
        viewMode: 'list',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'left-thumbs',
        showRecommendations: false,
        imageLook: 'clean',
        fieldsInBox: true,
        suggestedProductsLayout: 'list',
        suggestedProductsCount: 4,
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

/** Basic catalog #2 — grid boutique cards for visual dress browsing. */
function buildFashionBoutiqueList(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'fashion-boutique-list';
  const theme: ThemeSettings = {
    primaryColor: '#4a3728',
    secondaryColor: '#f5ebe0',
    backgroundColor: '#fffaf5',
    textColor: '#292524',
    accentColor: '#b45309',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'full-product-list',
      settings: {
        title: 'Shop dresses',
        showSearch: true,
        showCategoryFilters: true,
        showSort: true,
        viewMode: 'grid',
        cardStyle: 'boutique',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      content: {},
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Dress Rack',
      showAnnouncement: false,
      headerBg: '#fffaf5',
      headerTextColor: '#292524',
      headerVariant: headerVariantForTemplate(id),
      headerTagline: 'Curated dresses ready to ship — tap to order.',
      footerBg: '#ffffff',
      footerTextColor: '#292524',
      footerAccentColor: '#b45309',
      footerAccentBg: '#f5ebe0',
      footerWidth: 'boxed',
      ...footerPresetForVariant('classic'),
      footerDescription: 'Every dress photographed front, back, and label — shop with confidence.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Dress Rack — Curated fashion resale',
      metaDescription: 'Grid catalog of dresses with boutique-style cards and WhatsApp checkout.',
      keywords: 'dresses, boutique, fashion grid',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 3,
        cardsStyle: 'boutique',
        viewMode: 'grid',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'editorial',
        galleryLayout: 'stacked',
        showRecommendations: true,
        imageLook: 'soft',
        fieldsInBox: false,
        suggestedProductsLayout: 'cards',
        suggestedProductsCount: 4,
        showTrustBadges: true,
        ctaStyle: 'solid',
        showQuantitySelector: true,
        stickyBuyBar: false,
        orderCtaLabel: 'Reserve dress',
      },
    },
    versioning: {},
  };
}

/** Subtle & clean — soft linen palette, minimal blocks. */
function buildFashionLinen(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'fashion-linen';
  const theme: ThemeSettings = {
    primaryColor: '#78716c',
    secondaryColor: '#f5f5f4',
    backgroundColor: '#ffffff',
    textColor: '#44403c',
    accentColor: '#a8a29e',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'outline',
  };

  const sections = [
    templateSection({
      type: 'banner',
      settings: {
        height: 'medium',
        backgroundImage: img(id, 'hero.svg'),
        backgroundColor: '#fafaf9',
        overlayOpacity: 0.12,
        textAlignment: 'center',
      },
      content: {
        title: 'Quiet pieces for everyday elegance',
        subtitle: 'Neutral tones, flattering fits, and honest condition notes on every dress.',
        buttonText: 'View collection',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    templateSection({
      type: 'category-showcase',
      settings: {
        title: 'Shop by style',
        columns: 4,
        layout: 'grid',
        cardStyle: 'minimal',
        cardShape: 'rounded',
        cardSize: 'md',
        imageRatio: '3:4',
        imageFit: 'cover',
        gap: 'md',
        labelStyle: 'below',
        hoverEffect: 'lift',
        showCount: true,
        titleAlign: 'left',
      },
      content: { categoryIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'featured-products',
      settings: {
        title: 'Just arrived',
        displayMode: 'carousel',
        columns: 3,
        cardStyle: 'minimal',
        cardSize: 'md',
        itemsPerPage: 6,
        showPrice: true,
        showDescription: false,
        backgroundColor: '#ffffff',
      },
      content: { productIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'faq',
      settings: { title: 'Before you order', backgroundColor: '#fafaf9', padding: 'large' },
      content: {
        items: [
          {
            id: uuid(),
            question: 'How do I know my size?',
            answer: 'Each listing includes bust, waist, hip, and length measurements. Message us with your usual size for a quick fit check.',
          },
          {
            id: uuid(),
            question: 'Do you accept returns?',
            answer: 'We accept returns on unworn items within 48 hours of delivery if the tag is intact.',
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'cta',
      settings: {
        layout: 'single',
        backgroundColor: '#f5f5f4',
        buttonColor: '#57534e',
        textAlignment: 'center',
      },
      content: {
        title: 'Need styling help?',
        description: 'Send us an occasion and budget — we will shortlist dresses for you.',
        buttonText: 'Message the shop',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Linen Lane',
      showAnnouncement: false,
      headerBg: '#ffffff',
      headerTextColor: '#44403c',
      headerVariant: headerVariantForTemplate(id),
      ...footerPresetForVariant('clean'),
      footerDescription: 'Subtle, clean fashion resale focused on fit, fabric, and trust.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Linen Lane — Subtle dress resale',
      metaDescription: 'Clean, minimal storefront for dress resellers who value clarity over clutter.',
      keywords: 'minimal fashion, dresses, resale',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 3,
        cardsStyle: 'minimal',
        viewMode: 'grid',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'stacked',
        showRecommendations: true,
        imageLook: 'clean',
        fieldsInBox: false,
        suggestedProductsLayout: 'carousel',
        suggestedProductsCount: 4,
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

/** Modern — editorial carousel, elevated cards, split header. */
function buildFashionRunway(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'fashion-runway';
  const theme: ThemeSettings = {
    primaryColor: '#0f0f0f',
    secondaryColor: '#f4f4f5',
    backgroundColor: '#ffffff',
    textColor: '#18181b',
    accentColor: '#e11d48',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'carousel',
      settings: {
        height: 'large',
        aspectRatio: '16:9',
        autoPlay: true,
        interval: 5000,
        navigation: 'both',
        animation: 'fade',
      },
      content: {
        images: [
          {
            id: uuid(),
            url: img(id, 'slide1.svg'),
            title: 'New season drops',
            caption: 'Party dresses & evening edits',
            link: '/collections/all',
          },
          {
            id: uuid(),
            url: img(id, 'slide2.svg'),
            title: 'Workwear essentials',
            caption: 'Tailored looks under budget',
            link: '/collections/all',
          },
          {
            id: uuid(),
            url: img(id, 'slide3.svg'),
            title: 'Weekend casual',
            caption: 'Cotton, linen, and easy fits',
            link: '/collections/all',
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'product-grid',
      settings: {
        title: 'Trending now',
        columns: 4,
        displayMode: 'carousel',
        cardStyle: 'elevated',
        cardSize: 'md',
        sortBy: 'newest',
        itemsToShow: 12,
        showFilters: false,
        showSearch: false,
        backgroundColor: '#ffffff',
      },
      content: { productSource: 'all', productIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'two-column-content',
      settings: {
        columnLayout: 'text-left',
        backgroundColor: '#fafafa',
        padding: 'large',
        gap: 'large',
      },
      content: {
        leftContent: {
          title: 'Sell-through for resellers',
          description:
            'Highlight new arrivals, mark pieces as reserved, and move stock faster with a storefront that feels like a modern lookbook.',
          imageUrl: img(id, 'story.svg'),
        },
        rightContent: {
          title: 'Built for quick orders',
          description:
            'Customers browse on mobile, pick a size, and complete the order on WhatsApp — no complicated checkout.',
        },
      },
    } as HomepageSection),
    templateSection({
      type: 'testimonials',
      settings: {
        title: 'Repeat buyers',
        displayMode: 'grid',
        columns: 3,
        showRating: true,
        backgroundColor: '#ffffff',
      },
      content: {
        testimonials: [
          {
            id: uuid(),
            text: 'Photos matched the dress perfectly. Fit notes were spot on.',
            author: 'Ananya R.',
            role: 'Verified buyer',
            rating: 5,
          },
          {
            id: uuid(),
            text: 'Feels like shopping a small boutique, not a random listing page.',
            author: 'Mehek S.',
            role: 'Verified buyer',
            rating: 5,
          },
          {
            id: uuid(),
            text: 'Fast reply on sizing — ordered two dresses, kept both.',
            author: 'Priya K.',
            role: 'Verified buyer',
            rating: 4,
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'cta',
      settings: {
        layout: 'single',
        backgroundColor: '#0f0f0f',
        buttonColor: '#e11d48',
        textAlignment: 'center',
      },
      content: {
        title: 'Tonight’s outfit sorted',
        description: 'Browse the full rack — new pieces added through the week.',
        buttonText: 'Shop dresses',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Runway Rack',
      showAnnouncement: true,
      announcementText: 'Same-day dispatch on paid orders before 4 PM',
      announcementBg: '#e11d48',
      announcementTextColor: '#ffffff',
      headerBg: '#0f0f0f',
      headerTextColor: '#fafafa',
      headerVariant: headerVariantForTemplate(id),
      ...footerPresetForVariant('pulse'),
      footerDescription: 'Modern dress resale with lookbook energy and WhatsApp-ready ordering.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: [
        ...navHomeShop(),
        { id: uuid(), label: 'New in', href: '/collections/all' },
      ],
    },
    seo: {
      metaTitle: 'Runway Rack — Modern dress resale',
      metaDescription: 'Carousel-led fashion storefront for resellers who want a premium mobile experience.',
      keywords: 'modern fashion, dresses, resale',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 4,
        cardsStyle: 'elevated',
        viewMode: 'grid',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'tech',
        galleryLayout: 'left-thumbs',
        showRecommendations: true,
        imageLook: 'clean',
        fieldsInBox: false,
        suggestedProductsLayout: 'carousel',
        suggestedProductsCount: 6,
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

/** Traditional — warm heritage palette, centered header, rich storytelling. */
function buildFashionMaharani(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'fashion-maharani';
  const theme: ThemeSettings = {
    primaryColor: '#7f1d1d',
    secondaryColor: '#fef3c7',
    backgroundColor: '#fffbeb',
    textColor: '#451a03',
    accentColor: '#b45309',
    fontFamily: "'Playfair Display', Georgia, serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'banner',
      settings: {
        height: 'large',
        backgroundImage: img(id, 'hero.svg'),
        backgroundColor: '#7f1d1d',
        overlayOpacity: 0.4,
        textAlignment: 'center',
      },
      content: {
        title: 'Heritage silhouettes, ready to wear',
        subtitle: 'Festive sarees, lehengas, and occasion dresses sourced with care.',
        buttonText: 'Explore collection',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    templateSection({
      type: 'category-showcase',
      settings: {
        title: 'Shop by occasion',
        columns: 3,
        layout: 'carousel',
        navigation: 'both',
        cardStyle: 'overlay',
        cardShape: 'rounded',
        cardSize: 'lg',
        imageRatio: '2:3',
        labelStyle: 'overlay',
        hoverEffect: 'zoom',
        showCount: false,
        titleAlign: 'center',
        cardBackground: '#7f1d1d',
        labelColor: '#fef3c7',
      },
      content: { categoryIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'feature-card',
      settings: {
        layout: 'image-left',
        imageWidth: 'large',
        padding: 'large',
        backgroundColor: '#fef3c7',
        textColor: '#451a03',
      },
      content: {
        imageUrl: img(id, 'story.svg'),
        title: 'Hand-checked before listing',
        description:
          'Every piece is inspected for embroidery, lining, and zippers. We note minor flaws openly so buyers know exactly what they receive.',
        buttonText: 'Our process',
        buttonLink: '#',
      },
    } as HomepageSection),
    templateSection({
      type: 'featured-products',
      settings: {
        title: 'Featured ensembles',
        displayMode: 'carousel',
        columns: 3,
        cardStyle: 'flip-shop',
        cardSize: 'lg',
        itemsPerPage: 6,
        showPrice: true,
        showDescription: false,
        backgroundColor: '#fffbeb',
      },
      content: { productIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'content-grid',
      settings: {
        title: 'Why customers trust us',
        columns: 3,
        backgroundColor: '#ffffff',
        padding: 'large',
        gap: 'medium',
      },
      content: {
        items: [
          {
            id: uuid(),
            imageUrl: img(id, 'trust1.svg'),
            title: 'Video on request',
            description: 'Ask for a walkthrough video before you pay.',
            link: '#',
          },
          {
            id: uuid(),
            imageUrl: img(id, 'trust2.svg'),
            title: 'Alterations network',
            description: 'Partner tailors available for minor adjustments.',
            link: '#',
          },
          {
            id: uuid(),
            imageUrl: img(id, 'trust3.svg'),
            title: 'Secure packaging',
            description: 'Garments packed with tissue and stiffeners for shipping.',
            link: '#',
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'cta',
      settings: {
        layout: 'single',
        backgroundColor: '#7f1d1d',
        buttonColor: '#fbbf24',
        textAlignment: 'center',
      },
      content: {
        title: 'Reserve your look for the season',
        description: 'Limited pieces — message us to hold an item for 24 hours.',
        buttonText: 'Shop occasion wear',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Maharani Closet',
      showAnnouncement: true,
      announcementText: 'Festive season bookings open — reserve early',
      announcementBg: '#7f1d1d',
      announcementTextColor: '#fef3c7',
      headerBg: '#fffbeb',
      headerTextColor: '#451a03',
      headerVariant: headerVariantForTemplate(id),
      ...footerPresetForVariant('aurora'),
      footerDescription: 'Traditional occasion wear resale with storytelling that builds buyer confidence.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Maharani Closet — Traditional dress resale',
      metaDescription: 'Heritage-inspired theme for festive fashion resellers.',
      keywords: 'saree, lehenga, ethnic wear, dresses',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: false,
        columns: 3,
        cardsStyle: 'boutique',
        viewMode: 'list',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'editorial',
        galleryLayout: 'stacked',
        showRecommendations: true,
        imageLook: 'framed',
        fieldsInBox: true,
        suggestedProductsLayout: 'carousel',
        suggestedProductsCount: 4,
        showTrustBadges: true,
        ctaStyle: 'solid',
        showQuantitySelector: true,
        stickyBuyBar: false,
        orderCtaLabel: 'Reserve piece',
      },
    },
    versioning: {},
  };
}

/* ================================================================== */
/* JEWELLERY — fine, fashion & bridal sellers                          */
/* ================================================================== */

/** Basic catalog #1 — overlay cards to showcase pieces on image. */
function buildJewelTray(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'jewel-tray';
  const theme: ThemeSettings = {
    primaryColor: '#1e3a5f',
    secondaryColor: '#e8eef5',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
    accentColor: '#c9a227',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    headingFontFamily: "'DM Serif Display', Georgia, serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'full-product-list',
      settings: {
        title: '',
        showSearch: true,
        showCategoryFilters: true,
        showSort: true,
        viewMode: 'grid',
        cardStyle: 'overlay',
        productImageRatio: 'square',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      content: {},
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Jewel Tray',
      showAnnouncement: true,
      announcementText: 'Hallmark & weight mentioned on every piece',
      announcementBg: '#1e3a5f',
      announcementTextColor: '#ffffff',
      headerBg: '#f8fafc',
      headerTextColor: '#0f172a',
      headerVariant: headerVariantForTemplate(id),
      headerTagline: 'Necklaces, rings, and sets — order in seconds.',
      footerBg: '#ffffff',
      footerTextColor: '#0f172a',
      footerAccentColor: '#c9a227',
      footerAccentBg: '#e8eef5',
      footerWidth: 'boxed',
      ...footerPresetForVariant('classic'),
      footerDescription: 'Simple jewellery catalog built for quick browsing and WhatsApp orders.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Jewel Tray — Jewellery catalog',
      metaDescription: 'Grid catalogue with overlay cards for jewellery resellers.',
      keywords: 'jewellery, rings, necklaces, catalog',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 2,
        cardsStyle: 'overlay',
        viewMode: 'grid',
        productImageRatio: 'square',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'left-thumbs',
        showRecommendations: false,
        imageLook: 'framed',
        fieldsInBox: true,
        suggestedProductsLayout: 'cards',
        suggestedProductsCount: 4,
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

/** Basic catalog #2 — list layout with quick-shop rows for weight & price clarity. */
function buildJewelCounter(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'jewel-counter';
  const theme: ThemeSettings = {
    primaryColor: '#334155',
    secondaryColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    accentColor: '#0d9488',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'full-product-list',
      settings: {
        title: 'Today’s counter',
        showSearch: true,
        showCategoryFilters: true,
        showSort: true,
        viewMode: 'list',
        cardStyle: 'quick-shop',
        productImageRatio: 'square',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'price-low',
      },
      content: {},
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Gold Counter',
      showAnnouncement: false,
      headerBg: '#ffffff',
      headerTextColor: '#1e293b',
      headerVariant: headerVariantForTemplate(id),
      headerTagline: 'Daily rates updated — transparent weights & making charges.',
      footerBg: '#ffffff',
      footerTextColor: '#1e293b',
      footerAccentColor: '#0d9488',
      footerAccentBg: '#f0fdfa',
      footerWidth: 'boxed',
      ...footerPresetForVariant('classic'),
      footerDescription: 'Counter-style list for jewellers who sell by weight and SKU.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Gold Counter — Jewellery list store',
      metaDescription: 'List catalogue with quick-shop rows for rings, chains, and sets.',
      keywords: 'gold, silver, jewellery list',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 3,
        cardsStyle: 'quick-shop',
        viewMode: 'list',
        productImageRatio: 'square',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'price-low',
      },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'stacked',
        showRecommendations: true,
        imageLook: 'clean',
        fieldsInBox: true,
        suggestedProductsLayout: 'list',
        suggestedProductsCount: 5,
        showTrustBadges: true,
        ctaStyle: 'solid',
        showQuantitySelector: true,
        stickyBuyBar: false,
        orderCtaLabel: 'Confirm order',
      },
    },
    versioning: {},
  };
}

/** Subtle & clean — pearl tones, circle category tiles, soft typography. */
function buildJewelPearl(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'jewel-pearl';
  const theme: ThemeSettings = {
    primaryColor: '#6b5b4f',
    secondaryColor: '#f7f3ef',
    backgroundColor: '#fffcfa',
    textColor: '#3d3530',
    accentColor: '#c4a574',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'outline',
  };

  const sections = [
    templateSection({
      type: 'banner',
      settings: {
        height: 'medium',
        backgroundImage: img(id, 'hero.svg'),
        backgroundColor: '#f7f3ef',
        overlayOpacity: 0.1,
        textAlignment: 'center',
      },
      content: {
        title: 'Pieces that feel personal',
        subtitle: 'Delicate jewellery for daily wear — gift-ready packaging on request.',
        buttonText: 'Browse jewellery',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    templateSection({
      type: 'category-showcase',
      settings: {
        title: 'Collections',
        columns: 4,
        layout: 'grid',
        tilesAlign: 'center',
        cardStyle: 'card',
        cardShape: 'circle',
        cardSize: 'md',
        imageRatio: '1:1',
        labelStyle: 'below',
        hoverEffect: 'border',
        showCount: true,
        gap: 'lg',
        titleAlign: 'center',
      },
      content: { categoryIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'featured-products',
      settings: {
        title: 'Bestsellers',
        displayMode: 'carousel',
        columns: 3,
        cardStyle: 'minimal',
        cardSize: 'md',
        itemsPerPage: 6,
        showPrice: true,
        showDescription: false,
      },
      content: { productIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'divider',
      settings: { style: 'line', thickness: 'thin', width: 'medium', color: '#e7e0d8', spacing: 'medium' },
      content: {},
    } as HomepageSection),
    templateSection({
      type: 'text',
      settings: {
        alignment: 'center',
        fontSize: 'medium',
        padding: 'medium',
        textColor: '#6b5b4f',
        backgroundColor: '#fffcfa',
      },
      content: {
        text: 'Complimentary polishing cloth with every silver order above your store minimum.',
      },
    } as HomepageSection),
    templateSection({
      type: 'cta',
      settings: {
        layout: 'single',
        backgroundColor: '#f7f3ef',
        buttonColor: '#6b5b4f',
        textAlignment: 'center',
      },
      content: {
        title: 'Shopping for a gift?',
        description: 'Tell us the occasion — we will suggest pieces in your budget.',
        buttonText: 'View all jewellery',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Pearl Room',
      showAnnouncement: false,
      headerBg: '#fffcfa',
      headerTextColor: '#3d3530',
      headerVariant: headerVariantForTemplate(id),
      ...footerPresetForVariant('clean'),
      footerDescription: 'Soft, clean jewellery storefront for everyday and gifting collections.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Pearl Room — Subtle jewellery boutique',
      metaDescription: 'Champagne palette theme for delicate jewellery sellers.',
      keywords: 'pearls, silver, minimal jewellery',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: false,
        showSort: true,
        showSearch: true,
        columns: 3,
        cardsStyle: 'minimal',
        viewMode: 'grid',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'minimal',
        galleryLayout: 'stacked',
        showRecommendations: true,
        imageLook: 'soft',
        fieldsInBox: false,
        suggestedProductsLayout: 'cards',
        suggestedProductsCount: 4,
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

/** Modern — dark luxe, sticky buy bar, elevated grid. */
function buildJewelApex(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'jewel-apex';
  const theme: ThemeSettings = {
    primaryColor: '#c9a227',
    secondaryColor: '#0c1222',
    backgroundColor: '#060912',
    textColor: '#e8edf5',
    accentColor: '#60a5fa',
    fontFamily: "'Inter', system-ui, sans-serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'carousel',
      settings: {
        height: 'medium',
        aspectRatio: '16:9',
        autoPlay: true,
        interval: 6000,
        navigation: 'dots',
        animation: 'slide',
      },
      content: {
        images: [
          {
            id: uuid(),
            url: img(id, 'slide1.svg'),
            title: 'Signature solitaires',
            link: '/collections/all',
          },
          {
            id: uuid(),
            url: img(id, 'slide2.svg'),
            title: 'Everyday diamonds',
            link: '/collections/all',
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'product-grid',
      settings: {
        title: 'Showcase pieces',
        columns: 3,
        displayMode: 'grid',
        cardStyle: 'elevated',
        cardSize: 'lg',
        sortBy: 'price-high',
        itemsToShow: 9,
        showFilters: true,
        showSearch: true,
        backgroundColor: '#060912',
      },
      content: { productSource: 'all', productIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'video',
      settings: {
        width: 'large',
        aspectRatio: '16:9',
        autoPlay: false,
        controls: true,
        alignment: 'center',
      },
      content: {
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        posterImage: img(id, 'video-poster.svg'),
      },
    } as HomepageSection),
    templateSection({
      type: 'testimonials',
      settings: {
        title: 'Client stories',
        displayMode: 'carousel',
        columns: 1,
        showRating: true,
        backgroundColor: '#0c1222',
      },
      content: {
        testimonials: [
          {
            id: uuid(),
            text: 'Certificate shared before payment — exactly the professionalism I expected.',
            author: 'Rohan V.',
            role: 'Engagement ring buyer',
            rating: 5,
          },
          {
            id: uuid(),
            text: 'The mobile product page made it easy to compare two chains side by side.',
            author: 'Kavya M.',
            role: 'Repeat customer',
            rating: 5,
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'cta',
      settings: {
        layout: 'single',
        backgroundColor: '#c9a227',
        buttonColor: '#060912',
        textAlignment: 'center',
      },
      content: {
        title: 'Book a virtual try-on',
        description: 'See pieces live on video call before you confirm.',
        buttonText: 'Shop collection',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Apex Jewels',
      showAnnouncement: true,
      announcementText: 'Insured shipping on orders above your store minimum',
      announcementBg: '#c9a227',
      announcementTextColor: '#060912',
      headerBg: '#060912',
      headerTextColor: '#e8edf5',
      headerVariant: headerVariantForTemplate(id),
      ...footerPresetForVariant('pulse'),
      footerDescription: 'Modern luxe theme for jewellers selling premium pieces online.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: navHomeShop(),
    },
    seo: {
      metaTitle: 'Apex Jewels — Modern jewellery store',
      metaDescription: 'Dark luxe storefront with elevated cards and sticky mobile buying.',
      keywords: 'diamond, gold, modern jewellery',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: true,
        columns: 3,
        cardsStyle: 'elevated',
        viewMode: 'grid',
        productImageRatio: 'square',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'price-high',
      },
      product: {
        layoutVariant: 'tech',
        galleryLayout: 'left-thumbs',
        showRecommendations: true,
        imageLook: 'clean',
        fieldsInBox: false,
        suggestedProductsLayout: 'carousel',
        suggestedProductsCount: 6,
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

/** Traditional — royal maroon & gold, craftsmanship story, bridal focus. */
function buildJewelRoyal(): WebsiteModeConfig {
  resetTemplateSectionOrder();
  const id = 'jewel-royal';
  const theme: ThemeSettings = {
    primaryColor: '#831843',
    secondaryColor: '#fef9c3',
    backgroundColor: '#fffdf7',
    textColor: '#422006',
    accentColor: '#ca8a04',
    fontFamily: "'Playfair Display', Georgia, serif",
    buttonStyle: 'solid',
  };

  const sections = [
    templateSection({
      type: 'banner',
      settings: {
        height: 'large',
        backgroundImage: img(id, 'hero.svg'),
        backgroundColor: '#831843',
        overlayOpacity: 0.45,
        textAlignment: 'center',
      },
      content: {
        title: 'Crafted for milestones',
        subtitle: 'Bridal sets, temple jewellery, and heirlooms — authenticated and beautifully shot.',
        buttonText: 'View bridal edit',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    templateSection({
      type: 'category-showcase',
      settings: {
        title: 'Shop by type',
        columns: 3,
        layout: 'grid',
        cardStyle: 'bordered',
        cardShape: 'pill',
        cardSize: 'lg',
        imageRatio: '4:3',
        labelStyle: 'below',
        hoverEffect: 'lift',
        showCount: true,
        gap: 'md',
        cardBackground: '#fffdf7',
        labelColor: '#422006',
      },
      content: { categoryIds: [] },
    } as HomepageSection),
    templateSection({
      type: 'two-column-content',
      settings: {
        columnLayout: 'text-right',
        backgroundColor: '#fef9c3',
        padding: 'large',
        gap: 'large',
      },
      content: {
        leftContent: {
          title: 'Certification first',
          description:
            'BIS hallmarked gold, invoice on every sale, and detailed product cards with gross weight and stone details.',
        },
        rightContent: {
          title: 'Made for family jewellers',
          description:
            'Tell the story behind each collection — perfect for shops moving from showroom walk-ins to online orders.',
          imageUrl: img(id, 'craft.svg'),
        },
      },
    } as HomepageSection),
    templateSection({
      type: 'feature-card',
      settings: {
        layout: 'image-right',
        imageWidth: 'large',
        padding: 'large',
        backgroundColor: '#ffffff',
        textColor: '#422006',
      },
      content: {
        imageUrl: img(id, 'bridal.svg'),
        title: 'Bridal appointments',
        description:
          'Offer curated shortlists for wedding shoppers — share a private link with only the pieces you want them to see.',
        buttonText: 'Explore bridal',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
    templateSection({
      type: 'faq',
      settings: { title: 'Buyer assurance', backgroundColor: '#fffdf7', padding: 'large' },
      content: {
        items: [
          {
            id: uuid(),
            question: 'Is old gold exchange available?',
            answer: 'Yes — share photos and approximate weight on WhatsApp for a same-day estimate.',
          },
          {
            id: uuid(),
            question: 'Do you resize rings?',
            answer: 'Most bands can be resized within two sizes up or down. Ask before ordering.',
          },
          {
            id: uuid(),
            question: 'How is jewellery shipped?',
            answer: 'Tamper-proof boxes with insured courier on high-value pieces.',
          },
        ],
      },
    } as HomepageSection),
    templateSection({
      type: 'cta',
      settings: {
        layout: 'single',
        backgroundColor: '#831843',
        buttonColor: '#fbbf24',
        textAlignment: 'center',
      },
      content: {
        title: 'Visit our showroom or order online',
        description: 'Same trust, whether you walk in or message from home.',
        buttonText: 'Shop jewellery',
        buttonLink: '/collections/all',
      },
    } as HomepageSection),
  ];

  return {
    siteSettings: {
      websiteName: 'Royal Gem House',
      showAnnouncement: true,
      announcementText: 'Bridal season — book design consultations early',
      announcementBg: '#831843',
      announcementTextColor: '#fef9c3',
      headerBg: '#fffdf7',
      headerTextColor: '#422006',
      headerVariant: headerVariantForTemplate(id),
      ...footerPresetForVariant('aurora'),
      footerDescription: 'Traditional jewellery theme for family businesses and bridal specialists.',
      footerColumns: createDefaultFooterLinkColumns(),
      navItems: [
        ...navHomeShop(),
        { id: uuid(), label: 'Bridal', href: '/collections/all' },
      ],
    },
    seo: {
      metaTitle: 'Royal Gem House — Traditional jewellery',
      metaDescription: 'Heritage-inspired jewellery storefront with bridal storytelling.',
      keywords: 'bridal jewellery, gold, traditional',
      allowIndexing: true,
    },
    pages: { home: { sections, theme }, custom: [] },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        showSearch: false,
        columns: 3,
        cardsStyle: 'boutique',
        viewMode: 'list',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
      product: {
        layoutVariant: 'editorial',
        galleryLayout: 'stacked',
        showRecommendations: true,
        imageLook: 'framed',
        fieldsInBox: true,
        suggestedProductsLayout: 'cards',
        suggestedProductsCount: 4,
        showTrustBadges: true,
        ctaStyle: 'solid',
        showQuantitySelector: true,
        stickyBuyBar: false,
        orderCtaLabel: 'Reserve piece',
      },
    },
    versioning: {},
  };
}

export const INDUSTRY_WEBSITE_TEMPLATES: IndustryWebsiteTemplateMeta[] = [
  {
    id: 'fashion-wardrobe',
    name: 'Wardrobe Resale',
    tagline: 'Fashion · Catalog',
    description:
      'Classic list catalog for dress resellers — search, categories, portrait photos, and WhatsApp qty ordering.',
    previewImage: '/templates/fashion-wardrobe/preview.svg',
    palette: ['#9f1239', '#fce7f3', '#faf8f6', '#1c1917'],
    industry: 'fashion',
    style: 'catalog',
    build: buildFashionWardrobe,
  },
  {
    id: 'fashion-boutique-list',
    name: 'Dress Rack',
    tagline: 'Fashion · Grid catalog',
    description:
      'Grid catalog with boutique cards — still simple to run, but more visual for occasion and party dresses.',
    previewImage: '/templates/fashion-boutique-list/preview.svg',
    palette: ['#4a3728', '#b45309', '#fffaf5', '#292524'],
    industry: 'fashion',
    style: 'catalog',
    build: buildFashionBoutiqueList,
  },
  {
    id: 'fashion-linen',
    name: 'Linen Lane',
    tagline: 'Fashion · Subtle',
    description:
      'Soft neutrals, minimal category tiles, and calm typography — for resellers who want a quiet premium feel.',
    previewImage: '/templates/fashion-linen/preview.svg',
    palette: ['#78716c', '#fafaf9', '#ffffff', '#a8a29e'],
    industry: 'fashion',
    style: 'subtle',
    build: buildFashionLinen,
  },
  {
    id: 'fashion-runway',
    name: 'Runway Rack',
    tagline: 'Fashion · Modern',
    description:
      'Carousel hero, elevated product rails, and sticky mobile buying — built for fast-moving dress inventory.',
    previewImage: '/templates/fashion-runway/preview.svg',
    palette: ['#0f0f0f', '#e11d48', '#ffffff', '#18181b'],
    industry: 'fashion',
    style: 'modern',
    build: buildFashionRunway,
  },
  {
    id: 'fashion-maharani',
    name: 'Maharani Closet',
    tagline: 'Fashion · Traditional',
    description:
      'Festive maroon & gold storytelling with flip-shop highlights — ideal for ethnic and occasion wear resellers.',
    previewImage: '/templates/fashion-maharani/preview.svg',
    palette: ['#7f1d1d', '#fef3c7', '#b45309', '#fffbeb'],
    industry: 'fashion',
    style: 'traditional',
    build: buildFashionMaharani,
  },
  {
    id: 'jewel-tray',
    name: 'Jewel Tray',
    tagline: 'Jewellery · Catalog',
    description:
      'Overlay grid catalog that keeps focus on the piece — hallmark notes, search, and simple WhatsApp checkout.',
    previewImage: '/templates/jewel-tray/preview.svg',
    palette: ['#1e3a5f', '#c9a227', '#f8fafc', '#0f172a'],
    industry: 'jewellery',
    style: 'catalog',
    build: buildJewelTray,
  },
  {
    id: 'jewel-counter',
    name: 'Gold Counter',
    tagline: 'Jewellery · List catalog',
    description:
      'Counter-style list with quick-shop rows — clear for weight-based pricing and daily rate updates.',
    previewImage: '/templates/jewel-counter/preview.svg',
    palette: ['#334155', '#0d9488', '#ffffff', '#1e293b'],
    industry: 'jewellery',
    style: 'catalog',
    build: buildJewelCounter,
  },
  {
    id: 'jewel-pearl',
    name: 'Pearl Room',
    tagline: 'Jewellery · Subtle',
    description:
      'Champagne palette with circle collection tiles — delicate pieces, gifting, and everyday wear.',
    previewImage: '/templates/jewel-pearl/preview.svg',
    palette: ['#6b5b4f', '#c4a574', '#fffcfa', '#f7f3ef'],
    industry: 'jewellery',
    style: 'subtle',
    build: buildJewelPearl,
  },
  {
    id: 'jewel-apex',
    name: 'Apex Jewels',
    tagline: 'Jewellery · Modern',
    description:
      'Dark luxe layout with elevated showcase grid, video block, and sticky buy bar for premium inventory.',
    previewImage: '/templates/jewel-apex/preview.svg',
    palette: ['#c9a227', '#060912', '#60a5fa', '#e8edf5'],
    industry: 'jewellery',
    style: 'modern',
    build: buildJewelApex,
  },
  {
    id: 'jewel-royal',
    name: 'Royal Gem House',
    tagline: 'Jewellery · Traditional',
    description:
      'Bridal-forward heritage theme with certification story, FAQ assurance, and boutique list pages.',
    previewImage: '/templates/jewel-royal/preview.svg',
    palette: ['#831843', '#ca8a04', '#fef9c3', '#fffdf7'],
    industry: 'jewellery',
    style: 'traditional',
    build: buildJewelRoyal,
  },
];
