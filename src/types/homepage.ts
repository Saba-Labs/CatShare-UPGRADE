// Homepage Builder Types

import type { DefaultSorting } from './storeBehaviorSettings';

export type HomepageSectionType =
  | 'carousel'
  | 'text'
  | 'image'
  | 'banner'
  | 'featured-products'
  | 'category-showcase'
  | 'product-grid'
  | 'full-product-list'
  | 'announcement'
  | 'cta'
  | 'video'
  | 'testimonials'
  | 'footer'
  | 'feature-card'
  | 'two-column-content'
  | 'content-grid'
  | 'divider'
  | 'faq'
  | 'embed'
  | 'freeform';

export interface CarouselImage {
  id: string;
  url: string;
  title?: string;
  caption?: string;
  link?: string;
}

export interface CarouselSection {
  type: 'carousel';
  settings: {
    height: 'small' | 'medium' | 'large';
    aspectRatio: '16:9' | '4:3' | 'square';
    autoPlay: boolean;
    interval: number;
    navigation: 'dots' | 'arrows' | 'both' | 'none';
    animation: 'fade' | 'slide';
  };
  content: {
    images: CarouselImage[];
  };
}

export interface TextSection {
  type: 'text';
  settings: {
    alignment: 'left' | 'center' | 'right';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    textColor?: string;
    backgroundColor?: string;
    padding: 'small' | 'medium' | 'large';
  };
  content: {
    text: string;
  };
}

export interface ImageSection {
  type: 'image';
  settings: {
    width: 'small' | 'medium' | 'large' | 'full';
    alignment: 'left' | 'center' | 'right';
    rounded: boolean;
    shadow: boolean;
    link?: string;
  };
  content: {
    url: string;
    alt: string;
  };
}

export interface BannerSection {
  type: 'banner';
  settings: {
    height: 'small' | 'medium' | 'large';
    backgroundImage?: string;
    backgroundColor?: string;
    overlayOpacity: number;
    textAlignment: 'left' | 'center' | 'right';
  };
  content: {
    title: string;
    subtitle?: string;
    buttonText?: string;
    buttonLink?: string;
  };
}

export interface FeaturedProductsSection {
  type: 'featured-products';
  settings: {
    title: string;
    /** list/slider are legacy values kept for backward compatibility. */
    displayMode: 'grid' | 'carousel' | 'list' | 'slider';
    columns: 1 | 2 | 3 | 4 | 5 | 6;
    cardStyle?: 'minimal' | 'boxed';
    /** Responsive card density; layout auto-fits by viewport width. */
    cardSize?: 'sm' | 'md' | 'lg';
    itemsPerPage: number;
    showPrice: boolean;
    showDescription: boolean;
    backgroundColor?: string;
  };
  content: {
    productIds: string[];
  };
}

export interface CustomCategoryItem {
  id: string;
  label: string;
  imageUrl?: string;
  link?: string;
}

export interface CategoryShowcaseSection {
  type: 'category-showcase';
  settings: {
    title: string;
    columns: 2 | 3 | 4 | 5 | 6;
    /** How category tiles are arranged. */
    layout: 'grid' | 'list' | 'carousel';
    backgroundColor?: string;
    showCount: boolean;
    /** Card surface treatment. */
    cardStyle?: 'minimal' | 'card' | 'bordered' | 'overlay';
    /** Outer shape of each tile. */
    cardShape?: 'rounded' | 'sharp' | 'pill' | 'circle';
    /** Overall tile scale (image area height). */
    cardSize?: 'sm' | 'md' | 'lg' | 'xl';
    /** Image frame proportions (ignored for circle tiles in grid). */
    imageRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '2:3';
    imageFit?: 'cover' | 'contain';
    gap?: 'sm' | 'md' | 'lg';
    titleAlign?: 'left' | 'center' | 'right';
    /** Where the category name appears. */
    labelStyle?: 'below' | 'overlay';
    hoverEffect?: 'none' | 'lift' | 'zoom' | 'border';
    cardBackground?: string;
    labelColor?: string;
  };
  content: {
    categoryIds: string[];
    /** Per-category image overrides, keyed by derived category id. */
    categoryImages?: Record<string, string>;
    /** Manually added category tiles that aren't derived from products. */
    customCategories?: CustomCategoryItem[];
  };
}

export interface ProductGridSection {
  type: 'product-grid';
  settings: {
    title: string;
    columns: 1 | 2 | 3 | 4 | 5 | 6;
    /** list is a legacy value kept for backward compatibility. */
    displayMode: 'grid' | 'carousel' | 'list';
    cardStyle?: 'minimal' | 'boxed';
    /** Responsive card density; layout auto-fits by viewport width. */
    cardSize?: 'sm' | 'md' | 'lg';
    sortBy: 'default' | 'alphabetical' | 'price-low' | 'price-high' | 'newest';
    itemsToShow: number;
    showFilters: boolean;
    showSearch: boolean;
    backgroundColor?: string;
  };
  content: {
    /** How products are chosen for this grid (persisted; do not infer from ids alone). */
    productSource?: 'all' | 'category' | 'specific';
    categoryId?: string;
    productIds?: string[];
  };
}

/** Full catalog order list — same UX as classic default store (all products, qty controls). */
export interface FullProductListSection {
  type: 'full-product-list';
  settings: {
    title?: string;
    showSearch: boolean;
    showCategoryFilters: boolean;
    showSort: boolean;
    viewMode: 'list' | 'grid';
    productImageRatio: 'square' | 'portrait' | 'landscape';
    showPrice: boolean;
    showAvailability: boolean;
    defaultSorting: DefaultSorting;
    backgroundColor?: string;
  };
  content: Record<string, never>;
}

export interface AnnouncementSection {
  type: 'announcement';
  settings: {
    backgroundColor?: string;
    textColor?: string;
    icon?: 'info' | 'warning' | 'success' | 'none';
    dismissible: boolean;
  };
  content: {
    message: string;
  };
}

export interface CTASection {
  type: 'cta';
  settings: {
    layout: 'two-column' | 'single' | 'full-width';
    backgroundColor?: string;
    buttonColor?: string;
    textAlignment: 'left' | 'center' | 'right';
  };
  content: {
    title: string;
    description?: string;
    buttonText: string;
    buttonLink: string;
  };
}

export interface VideoSection {
  type: 'video';
  settings: {
    width: 'small' | 'medium' | 'large' | 'full';
    aspectRatio: '16:9' | '4:3' | 'square';
    autoPlay: boolean;
    controls: boolean;
    alignment: 'left' | 'center' | 'right';
  };
  content: {
    videoUrl: string;
    posterImage?: string;
  };
}

export interface Testimonial {
  id: string;
  text: string;
  author: string;
  role?: string;
  image?: string;
  /** 1–5 stars; defaults to 5 when showRating is enabled */
  rating?: number;
}

export interface TestimonialsSection {
  type: 'testimonials';
  settings: {
    title: string;
    displayMode: 'carousel' | 'grid';
    columns: 1 | 2 | 3;
    backgroundColor?: string;
    showRating: boolean;
  };
  content: {
    testimonials: Testimonial[];
  };
}

export interface FooterSection {
  type: 'footer';
  settings: {
    backgroundColor?: string;
    textColor?: string;
    layout: 'multi-column' | 'single';
  };
  content: {
    company?: string;
    description?: string;
    links: Array<{ title: string; url: string }>;
    social?: Array<{ platform: string; url: string }>;
    copyright?: string;
  };
}

export interface FeatureCard {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  link?: string;
}

export interface FeatureCardSection {
  type: 'feature-card';
  settings: {
    layout: 'image-left' | 'image-right';
    imageWidth: 'small' | 'medium' | 'large';
    backgroundColor?: string;
    textColor?: string;
    padding: 'small' | 'medium' | 'large';
  };
  content: {
    imageUrl: string;
    title: string;
    description: string;
    buttonText?: string;
    buttonLink?: string;
  };
}

export interface TwoColumnContentSection {
  type: 'two-column-content';
  settings: {
    columnLayout: 'text-left' | 'text-right';
    backgroundColor?: string;
    padding: 'small' | 'medium' | 'large';
    gap: 'small' | 'medium' | 'large';
  };
  content: {
    leftContent: {
      title: string;
      description: string;
      imageUrl?: string;
    };
    rightContent: {
      title: string;
      description: string;
      imageUrl?: string;
    };
  };
}

export interface ContentGridItem {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  link?: string;
}

export interface ContentGridSection {
  type: 'content-grid';
  settings: {
    title?: string;
    columns: 2 | 3 | 4;
    backgroundColor?: string;
    padding: 'small' | 'medium' | 'large';
    gap: 'small' | 'medium' | 'large';
  };
  content: {
    items: ContentGridItem[];
  };
}

export interface DividerSection {
  type: 'divider';
  settings: {
    style: 'line' | 'dots' | 'space';
    thickness: 'thin' | 'medium' | 'thick';
    color?: string;
    width: 'full' | 'medium' | 'narrow';
    spacing: 'small' | 'medium' | 'large';
  };
  content: Record<string, never>;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSection {
  type: 'faq';
  settings: {
    title?: string;
    backgroundColor?: string;
    padding: 'small' | 'medium' | 'large';
  };
  content: {
    items: FaqItem[];
  };
}

export interface EmbedSection {
  type: 'embed';
  settings: {
    aspectRatio: '16:9' | '4:3' | 'auto';
    alignment: 'left' | 'center' | 'right';
    maxWidth: 'small' | 'medium' | 'full';
  };
  content: {
    embedUrl: string;
    title?: string;
  };
}

export type FreeformElementType = 'text' | 'image' | 'button';

/** Position and size within a design canvas (% of canvas box). */
export interface FreeformElementLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface FreeformTextElement {
  id: string;
  type: 'text';
  layout: FreeformElementLayout;
  content: {
    text: string;
    fontSize?: number;
    color?: string;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface FreeformImageElement {
  id: string;
  type: 'image';
  layout: FreeformElementLayout;
  content: {
    url: string;
    alt?: string;
    objectFit?: 'cover' | 'contain' | 'fill';
    rounded?: boolean;
    shadow?: boolean;
  };
}

export interface FreeformButtonElement {
  id: string;
  type: 'button';
  layout: FreeformElementLayout;
  content: {
    label: string;
    href: string;
  };
}

export type FreeformElement = FreeformTextElement | FreeformImageElement | FreeformButtonElement;

export interface FreeformSection {
  type: 'freeform';
  settings: {
    minHeightPx: number;
    backgroundColor?: string;
  };
  content: {
    elements: FreeformElement[];
  };
}

export type HomepageSection =
  | CarouselSection
  | TextSection
  | ImageSection
  | BannerSection
  | FeaturedProductsSection
  | CategoryShowcaseSection
  | ProductGridSection
  | FullProductListSection
  | AnnouncementSection
  | CTASection
  | VideoSection
  | TestimonialsSection
  | FooterSection
  | FeatureCardSection
  | TwoColumnContentSection
  | ContentGridSection
  | DividerSection
  | FaqSection
  | EmbedSection
  | FreeformSection;

export interface ThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  accentColor?: string;
  buttonStyle?: 'solid' | 'outline' | 'soft';
}

export interface GridPosition {
  column: number;
  row: number;
  width: number;
  height: number;
}

/** Horizontal placement of a block within its full-width row. */
export type BlockAlign = 'left' | 'center' | 'right';

/** Per-block layout used by the document-stack editor (resizable width/height). */
export interface BlockLayout {
  /** Block width as a percentage of the content area (20–100). */
  widthPercent?: number;
  /** Optional fixed block height in pixels. Unset = natural content height. */
  heightPx?: number;
  align?: BlockAlign;
}

export type LayoutSection = HomepageSection & {
  id: string;
  order: number;
  gridPosition?: GridPosition;
  blockLayout?: BlockLayout;
};

export interface HomepageLayout {
  sections: LayoutSection[];
  theme: ThemeSettings;
  gridColumns?: number;
  gridGap?: number;
  /** Website-mode extension for full storefront customization. */
  websiteConfig?: WebsiteModeConfig;
}

export interface WebsiteNavItem {
  id: string;
  label: string;
  href: string;
  children?: WebsiteNavItem[];
}

export interface WebsiteCustomPage {
  id: string;
  title: string;
  slug: string;
  layout: Pick<HomepageLayout, 'sections' | 'theme' | 'gridColumns' | 'gridGap'>;
}

export interface WebsiteSeoSettings {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string;
  ogImageUrl?: string;
  faviconUrl?: string;
  /** When false, adds noindex for the storefront */
  allowIndexing?: boolean;
  /** Optional Google Search Console verification token (meta tag content) */
  googleSiteVerification?: string;
}

/** Visual style of the global storefront footer. */
export type WebsiteFooterVariant = 'classic' | 'aurora' | 'pulse' | 'clean';

/** Boxed card vs edge-to-edge footer on the page. */
export type WebsiteFooterWidth = 'boxed' | 'full';

/** Header layout on the storefront (classic bar, centered, minimal, split, orderform hero). */
export type WebsiteHeaderVariant = 'classic' | 'centered' | 'minimal' | 'split' | 'orderform';

export interface WebsiteSiteSettings {
  websiteName: string;
  logoUrl?: string;
  announcementText?: string;
  showAnnouncement?: boolean;
  announcementBg?: string;
  announcementTextColor?: string;
  navItems: WebsiteNavItem[];
  /** Header layout — classic, centered, minimal, split bar, or orderform store hero. */
  headerVariant?: WebsiteHeaderVariant;
  headerBg?: string;
  headerTextColor?: string;
  /** Tagline under the store name (orderform hero layout; falls back to footer description). */
  headerTagline?: string;
  /** Longer blurb under the tagline (orderform hero layout). */
  headerAbout?: string;
  /** Footer layout (info cards, link columns, centered, split bar) — not colors. */
  footerVariant?: WebsiteFooterVariant;
  /** Boxed card (default) or full-width strip edge to edge. */
  footerWidth?: WebsiteFooterWidth;
  footerBg?: string;
  footerTextColor?: string;
  footerColBg?: string;
  footerAccentColor?: string;
  footerAccentBg?: string;
  footerBorderColor?: string;
  /** Short tagline under the store name in the global footer. */
  footerDescription?: string;
  /** @deprecated Ignored — “Powered by CatShare” is fixed in the site footer. */
  footerCopyright?: string;
  footerShowOpenBadge?: boolean;
  footerOpenBadgeLabel?: string;
  /** Override business profile / store address in footer. */
  footerLocationText?: string;
  footerPhoneText?: string;
  footerEmailText?: string;
  footerShowLocation?: boolean;
  footerShowContact?: boolean;
  footerShowStoreInfo?: boolean;
  footerShowFollow?: boolean;
  /** Footer link columns (e.g. Shop, Customer care, Legal) — vertical lists under each title. */
  footerColumns?: Array<{ title: string; links: WebsiteNavItem[] }>;
  /** @deprecated */
  footerLayout?: 'columns' | 'minimal' | 'centered';
}

export interface WebsiteCollectionTemplate {
  showFilters: boolean;
  showSort: boolean;
  columns: 2 | 3 | 4;
  cardsStyle: 'minimal' | 'boxed';
}

export interface WebsiteProductTemplate {
  /** Overall structure of the storefront product/order page. */
  layoutVariant?: 'editorial' | 'tech' | 'minimal';
  galleryLayout: 'left-thumbs' | 'stacked';
  showRecommendations: boolean;
  /** Image panel treatment on product pages. */
  imageLook?: 'clean' | 'soft' | 'framed';
  /** Show product detail fields inside a bordered box (default) or as plain rows. */
  fieldsInBox?: boolean;
  /** @deprecated Use fieldsInBox. Kept for saved configs (striped row backgrounds). */
  fieldsLook?: 'plain' | 'card' | 'striped';
  /** @deprecated Product pages inherit the store theme. Ignored if present. */
  colorTheme?: 'brand' | 'neutral' | 'warm' | 'dark';
  /** @deprecated Product pages inherit the store theme. Ignored if present. */
  customColors?: {
    pageBackground?: string;
    surfaceBackground?: string;
    textPrimary?: string;
    textMuted?: string;
    borderColor?: string;
    accentColor?: string;
    buttonBackground?: string;
    buttonText?: string;
  };
  /** Suggested product section layout. */
  suggestedProductsLayout?: 'cards' | 'list' | 'carousel';
  /** Number of suggested products to render. */
  suggestedProductsCount?: number;
  showTrustBadges: boolean;
  ctaStyle: 'solid' | 'outline';
  /** Show a quantity selector in the ordering UI (defaults to true). */
  showQuantitySelector?: boolean;
  /** Pin a buy bar to the bottom of the screen on mobile. */
  stickyBuyBar?: boolean;
  /** Custom label for the order action button. */
  orderCtaLabel?: string;
}

/** Selected storefront template — applies site-wide (home, shop, checkout, custom pages). */
export type WebsiteActiveTemplateId =
  | 'aurora-boutique'
  | 'pulse-tech'
  | 'clean-market'
  | 'studio-commerce'
  | 'default-store';

export interface WebsiteModeConfig {
  siteSettings: WebsiteSiteSettings;
  seo?: WebsiteSeoSettings;
  /** Last applied website template (colors, footer, collection/product layouts). */
  activeTemplateId?: WebsiteActiveTemplateId;
  pages: {
    home: HomepageLayout;
    custom?: WebsiteCustomPage[];
  };
  templates: {
    collection: WebsiteCollectionTemplate;
    product: WebsiteProductTemplate;
  };
  versioning?: {
    publishedAt?: string;
    updatedBy?: string;
  };
}

export interface HomepageConfig {
  id: string;
  storeId: string;
  layout: HomepageLayout;
  publishedLayout?: HomepageLayout;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  autoSavedAt?: string;
}

export interface BuilderState {
  layout: HomepageLayout;
  selectedSectionId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  history: HomepageLayout[];
  future: HomepageLayout[];
}

export interface BuilderAction {
  type:
    | 'ADD_SECTION'
    | 'REMOVE_SECTION'
    | 'UPDATE_SECTION'
    | 'REORDER_SECTIONS'
    | 'SELECT_SECTION'
    | 'UPDATE_THEME'
    | 'SET_LAYOUT'
    | 'SET_ERROR'
    | 'MARK_SAVED'
    | 'UPDATE_SECTION_POSITION'
    | 'UPDATE_WEBSITE_CONFIG'
    | 'UPDATE_SECTION_LAYOUT'
    | 'SWITCH_EDITING_PAGE'
    | 'ADD_PRESET_SECTIONS'
    | 'INSERT_SECTION_AT'
    | 'INSERT_PRESET_AT'
    | 'ADD_FREEFORM_ELEMENT'
    | 'UNDO'
    | 'REDO';
  payload?: any;
}
