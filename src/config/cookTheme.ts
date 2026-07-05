import { v4 as uuid } from 'uuid';
import type {
  HomepageLayout,
  HomepageSection,
  ThemeSettings,
  WebsiteCustomPage,
  WebsiteFooterVariant,
  WebsiteHeaderVariant,
  WebsiteModeConfig,
  WebsiteNavItem,
} from '../types/homepage';
import { createDefaultFooterLinkColumns, FOOTER_VARIANT_OPTIONS, footerPresetForVariant } from './footerVariants';
import { HEADER_VARIANT_OPTIONS, headerPresetForVariant } from './headerVariants';
import type { ProductCardStyle } from '../utils/productCardStyles';
import { PRODUCT_CARD_STYLE_META } from '../utils/productCardStyles';

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

export type CookButtonStyle = NonNullable<ThemeSettings['buttonStyle']>;

export interface CookCategoryStyle {
  cardStyle: 'minimal' | 'card';
  cardShape: 'rounded' | 'circle';
  cardSize: 'sm' | 'md' | 'lg';
  layout: 'grid' | 'carousel';
}

export const DEFAULT_COOK_CATEGORY_STYLE: CookCategoryStyle = {
  cardStyle: 'card',
  cardShape: 'rounded',
  cardSize: 'md',
  layout: 'grid',
};

export const COOK_BUTTON_STYLE_OPTIONS: { id: CookButtonStyle; label: string; hint: string }[] = [
  { id: 'solid', label: 'Solid', hint: 'Filled buttons — clear primary actions' },
  { id: 'outline', label: 'Outline', hint: 'Bordered buttons — lighter, editorial feel' },
  { id: 'soft', label: 'Soft', hint: 'Tinted fill — friendly and approachable' },
];

export const COOK_PRODUCT_CARD_OPTIONS: { id: ProductCardStyle; label: string; hint: string }[] = (
  Object.entries(PRODUCT_CARD_STYLE_META) as [ProductCardStyle, (typeof PRODUCT_CARD_STYLE_META)[ProductCardStyle]][]
).map(([id, meta]) => ({
  id,
  label: meta.label,
  hint: meta.summary,
}));

export const COOK_HEADER_OPTIONS = HEADER_VARIANT_OPTIONS.map((opt) => ({
  id: opt.id,
  label: opt.label,
  hint: opt.description,
}));

export const COOK_FOOTER_OPTIONS = FOOTER_VARIANT_OPTIONS.map((opt) => ({
  id: opt.id,
  label: opt.label,
  hint: opt.description,
}));

export type CookPolicyPageId =
  | 'contact'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms'
  | 'refund'
  | 'faq'
  | 'about';

export interface CookPolicyPageOption {
  id: CookPolicyPageId;
  label: string;
  description: string;
  slug: string;
  /** Footer column group for link placement. */
  footerGroup: 'customer-care' | 'legal' | 'company';
  defaultSelected: boolean;
}

export const COOK_POLICY_PAGE_OPTIONS: CookPolicyPageOption[] = [
  {
    id: 'contact',
    label: 'Contact',
    description: 'How customers reach you — email, phone, or form intro',
    slug: 'contact',
    footerGroup: 'customer-care',
    defaultSelected: true,
  },
  {
    id: 'shipping',
    label: 'Shipping',
    description: 'Delivery times, zones, and shipping fees',
    slug: 'shipping',
    footerGroup: 'customer-care',
    defaultSelected: true,
  },
  {
    id: 'returns',
    label: 'Returns & exchanges',
    description: 'Return window and how to send items back',
    slug: 'returns',
    footerGroup: 'customer-care',
    defaultSelected: true,
  },
  {
    id: 'faq',
    label: 'FAQs',
    description: 'Common questions about orders and products',
    slug: 'faq',
    footerGroup: 'customer-care',
    defaultSelected: false,
  },
  {
    id: 'privacy',
    label: 'Privacy policy',
    description: 'How you collect and use customer data',
    slug: 'privacy-policy',
    footerGroup: 'legal',
    defaultSelected: true,
  },
  {
    id: 'terms',
    label: 'Terms & conditions',
    description: 'Store rules, liability, and purchase terms',
    slug: 'terms',
    footerGroup: 'legal',
    defaultSelected: true,
  },
  {
    id: 'refund',
    label: 'Refund policy',
    description: 'Refund eligibility and processing times',
    slug: 'refund-policy',
    footerGroup: 'legal',
    defaultSelected: false,
  },
  {
    id: 'about',
    label: 'About us',
    description: 'Your brand story and what you sell',
    slug: 'about',
    footerGroup: 'company',
    defaultSelected: false,
  },
];

export const DEFAULT_COOK_POLICY_PAGES: CookPolicyPageId[] = COOK_POLICY_PAGE_OPTIONS.filter(
  (p) => p.defaultSelected
).map((p) => p.id);

export interface CookStorefrontChoices {
  headerVariant: WebsiteHeaderVariant;
  footerVariant: WebsiteFooterVariant;
  buttonStyle: CookButtonStyle;
  productCardStyle: ProductCardStyle;
  categoryStyle: CookCategoryStyle;
}

export const DEFAULT_COOK_STOREFRONT: CookStorefrontChoices = {
  headerVariant: 'classic',
  footerVariant: 'clean',
  buttonStyle: 'solid',
  productCardStyle: 'minimal',
  categoryStyle: DEFAULT_COOK_CATEGORY_STYLE,
};

const POLICY_PAGE_COPY: Record<CookPolicyPageId, { heading: string; body: string }> = {
  contact: {
    heading: 'Contact us',
    body:
      '<p>We&apos;re happy to help with orders, sizing, and product questions.</p><p><strong>Email:</strong> hello@yourstore.com<br /><strong>Phone:</strong> Add your number<br /><strong>Hours:</strong> Mon–Sat, 10am–6pm</p><p>Replace this text with your real contact details.</p>',
  },
  shipping: {
    heading: 'Shipping information',
    body:
      '<p>Orders are packed within 1–2 business days.</p><p><strong>Local delivery:</strong> 2–4 business days<br /><strong>National shipping:</strong> 5–7 business days<br /><strong>Free shipping:</strong> On orders above your minimum (set in checkout settings)</p><p>Update these timelines to match how you actually ship.</p>',
  },
  returns: {
    heading: 'Returns & exchanges',
    body:
      '<p>We accept returns within 14 days of delivery for unused items in original packaging.</p><p>To start a return, contact us with your order number. Exchanges are subject to stock availability.</p><p>Customize this policy for your store category and local regulations.</p>',
  },
  faq: {
    heading: 'Frequently asked questions',
    body:
      '<p><strong>How do I place an order?</strong><br />Browse products, add quantities, and submit your order link.</p><p><strong>Can I change my order?</strong><br />Message us as soon as possible — we&apos;ll help if packing hasn&apos;t started.</p><p><strong>Do you offer gift wrapping?</strong><br />Add a note at checkout or contact us before ordering.</p>',
  },
  privacy: {
    heading: 'Privacy policy',
    body:
      '<p>We collect information you provide at checkout (name, phone, address) to fulfill orders and support you.</p><p>We do not sell personal data. Payment details are handled by your payment provider.</p><p>Replace this draft with a policy reviewed for your jurisdiction.</p>',
  },
  terms: {
    heading: 'Terms & conditions',
    body:
      '<p>By using this store you agree to these terms. Products are sold subject to availability. Prices may change without notice.</p><p>We are not liable for indirect damages. Local consumer laws may give you additional rights.</p><p>Have a legal professional review before going live.</p>',
  },
  refund: {
    heading: 'Refund policy',
    body:
      '<p>Approved refunds are processed within 5–10 business days to your original payment method.</p><p>Shipping fees are non-refundable unless the return is due to our error.</p><p>Align this with your returns page and payment provider rules.</p>',
  },
  about: {
    heading: 'About us',
    body:
      '<p>We curate quality products with a shopping experience you can trust.</p><p>Share your story — why you started, what you stand for, and what makes your catalog special.</p><p>Add photos or a founder note on this page anytime in the builder.</p>',
  },
};

function cookCategorySectionSelected(selected: Set<CookSectionId>): boolean {
  return selected.has('categories') || selected.has('featured-collections');
}

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

function storeCategoryShowcase(
  title: string,
  theme: ThemeSettings,
  columns = 4,
  categoryStyle?: CookCategoryStyle
): BuilderSection {
  const style = categoryStyle || DEFAULT_COOK_CATEGORY_STYLE;
  return section({
    type: 'category-showcase',
    settings: {
      title,
      columns,
      layout: style.layout,
      showCount: true,
      backgroundColor: theme.backgroundColor,
      cardStyle: style.cardStyle,
      cardShape: style.cardShape,
      cardSize: style.cardSize,
      gap: 'md',
      labelStyle: 'below',
      hoverEffect: 'lift',
    },
    content: {
      categoryIds: [],
      customCategories: [],
    },
  } as HomepageSection);
}

function buildSectionForId(
  id: CookSectionId,
  theme: ThemeSettings,
  categoryStyle?: CookCategoryStyle
): BuilderSection | null {
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
      return storeCategoryShowcase('Shop by category', theme, 4, categoryStyle);

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
  storefront?: Partial<CookStorefrontChoices>;
  policyPages?: CookPolicyPageId[];
}

function footerLink(label: string, href: string): WebsiteNavItem {
  return { id: uuid(), label, href };
}

function buildPolicyPage(option: CookPolicyPageOption, theme: ThemeSettings): WebsiteCustomPage {
  const copy = POLICY_PAGE_COPY[option.id];
  return {
    id: uuid(),
    title: option.label,
    slug: option.slug,
    layout: {
      sections: [
        section({
          type: 'text',
          settings: {
            alignment: 'left',
            fontSize: 'large',
            padding: 'large',
            backgroundColor: theme.backgroundColor,
            textColor: theme.textColor,
          },
          content: {
            text: `<h1>${copy.heading}</h1>${copy.body}`,
          },
        } as HomepageSection),
      ],
      theme: { ...theme },
    },
  };
}

function buildFooterColumnsForPages(selectedPageIds: CookPolicyPageId[]): Array<{ title: string; links: WebsiteNavItem[] }> {
  const byId = new Map(COOK_POLICY_PAGE_OPTIONS.map((p) => [p.id, p]));

  const shopLinks = [
    footerLink('All products', '/collections/all'),
    footerLink('Collections', '/collections/all'),
  ];

  const careLinks: WebsiteNavItem[] = [];
  const legalLinks: WebsiteNavItem[] = [];
  const companyLinks: WebsiteNavItem[] = [];

  for (const pageId of selectedPageIds) {
    const meta = byId.get(pageId);
    if (!meta) continue;
    const link = footerLink(meta.label, `/${meta.slug}`);
    if (meta.footerGroup === 'customer-care') careLinks.push(link);
    else if (meta.footerGroup === 'legal') legalLinks.push(link);
    else companyLinks.push(link);
  }

  const columns: Array<{ title: string; links: WebsiteNavItem[] }> = [{ title: 'Shop', links: shopLinks }];

  if (careLinks.length) columns.push({ title: 'Customer care', links: careLinks });
  if (legalLinks.length) columns.push({ title: 'Legal', links: legalLinks });
  if (companyLinks.length) columns.push({ title: 'Company', links: companyLinks });

  return columns.length > 1 ? columns : createDefaultFooterLinkColumns();
}

function buildNavItems(
  showHeader: boolean,
  selectedPageIds: CookPolicyPageId[]
): WebsiteNavItem[] {
  if (!showHeader) {
    return [{ id: uuid(), label: 'Home', href: '/' }];
  }

  const items: WebsiteNavItem[] = [
    { id: uuid(), label: 'Home', href: '/' },
    { id: uuid(), label: 'Shop', href: '/collections/all' },
  ];

  if (selectedPageIds.includes('about')) {
    items.push({ id: uuid(), label: 'About', href: '/about' });
  }
  if (selectedPageIds.includes('contact')) {
    items.push({ id: uuid(), label: 'Contact', href: '/contact' });
  }

  return items;
}

export function buildCookedWebsiteConfig(input: CookThemeInput): WebsiteModeConfig {
  resetOrder();
  const { sections: selected, theme: baseTheme, storeName = 'My Store' } = input;
  const selectedSet = new Set(selected);
  const storefront: CookStorefrontChoices = {
    ...DEFAULT_COOK_STOREFRONT,
    ...input.storefront,
    categoryStyle: {
      ...DEFAULT_COOK_CATEGORY_STYLE,
      ...input.storefront?.categoryStyle,
    },
  };
  const policyPageIds = input.policyPages ?? DEFAULT_COOK_POLICY_PAGES;
  const theme: ThemeSettings = {
    ...baseTheme,
    buttonStyle: storefront.buttonStyle,
  };
  const categoryStyle = cookCategorySectionSelected(selectedSet) ? storefront.categoryStyle : undefined;

  const pageSections: BuilderSection[] = [];
  for (const option of COOK_SECTION_OPTIONS) {
    if (option.kind !== 'section' || !selectedSet.has(option.id)) continue;
    const built = buildSectionForId(option.id, theme, categoryStyle);
    if (built) pageSections.push(built);
  }

  const customPages = COOK_POLICY_PAGE_OPTIONS.filter((p) => policyPageIds.includes(p.id)).map((p) =>
    buildPolicyPage(p, theme)
  );

  const showAnnouncement = selectedSet.has('announcement-bar');
  const showHeader = selectedSet.has('header');
  const showFooter = selectedSet.has('footer');

  const headerPreset = headerPresetForVariant(storefront.headerVariant);
  const footerPreset = footerPresetForVariant(storefront.footerVariant);

  return {
    siteSettings: {
      websiteName: storeName,
      showAnnouncement,
      announcementText: showAnnouncement ? 'Free shipping on orders above your store minimum' : '',
      announcementBg: theme.primaryColor,
      announcementTextColor: '#ffffff',
      ...(showHeader ? headerPreset : { headerVariant: storefront.headerVariant }),
      headerBg: showHeader ? theme.backgroundColor : '#ffffff',
      headerTextColor: showHeader ? theme.textColor : '#111827',
      ...(showFooter ? footerPreset : footerPresetForVariant('clean')),
      footerDescription: showFooter
        ? 'Modern essentials, thoughtfully made. Quality products with a shopping experience you can trust.'
        : '',
      footerColumns: buildFooterColumnsForPages(policyPageIds),
      navItems: buildNavItems(showHeader, policyPageIds),
    },
    seo: {
      metaTitle: storeName,
      metaDescription: `${storeName} — shop our curated collection.`,
      keywords: '',
      allowIndexing: true,
    },
    pages: {
      home: { sections: pageSections, theme: { ...theme } },
      custom: customPages,
    },
    templates: {
      collection: {
        showFilters: true,
        showSort: true,
        columns: 4,
        cardsStyle: storefront.productCardStyle,
        viewMode: 'grid',
        productImageRatio: 'portrait',
        showPrice: true,
        showAvailability: true,
        defaultSorting: 'newest',
      },
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

export interface CookPreviewLayoutOptions {
  /** Match builder mobile viewport column counts (default true). */
  mobileViewport?: boolean;
}

/** Live storefront layout for Cook a theme preview — uses real section renderers. */
export function buildCookPreviewLayout(
  input: CookThemeInput,
  options: CookPreviewLayoutOptions = {}
): HomepageLayout {
  const mobileViewport = options.mobileViewport !== false;
  const config = buildCookedWebsiteConfig(input);
  const storefront: CookStorefrontChoices = {
    ...DEFAULT_COOK_STOREFRONT,
    ...input.storefront,
    categoryStyle: {
      ...DEFAULT_COOK_CATEGORY_STYLE,
      ...input.storefront?.categoryStyle,
    },
  };

  const sections: BuilderSection[] = config.pages.home.sections.map((section) => {
    if (section.type === 'featured-products' || section.type === 'product-grid') {
      return {
        ...section,
        settings: {
          ...section.settings,
          cardStyle: storefront.productCardStyle,
          columns: mobileViewport ? (2 as const) : (4 as const),
        },
      } as BuilderSection;
    }
    if (section.type === 'category-showcase' && mobileViewport) {
      const columns = 'columns' in section.settings ? section.settings.columns : 4;
      return {
        ...section,
        settings: {
          ...section.settings,
          columns: Math.min(typeof columns === 'number' ? columns : 4, 2) as 1 | 2 | 3 | 4 | 5 | 6,
        },
      } as BuilderSection;
    }
    return section;
  });

  return {
    sections,
    theme: { ...config.pages.home.theme },
    websiteConfig: config,
  };
}
