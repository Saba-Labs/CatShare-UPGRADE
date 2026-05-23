// Homepage Builder Types

export type HomepageSectionType =
  | 'carousel'
  | 'text'
  | 'image'
  | 'banner'
  | 'featured-products'
  | 'category-showcase'
  | 'product-grid'
  | 'announcement'
  | 'cta'
  | 'video'
  | 'testimonials'
  | 'footer'
  | 'feature-card'
  | 'two-column-content'
  | 'content-grid';

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
    displayMode: 'grid' | 'slider' | 'carousel';
    columns: 1 | 2 | 3 | 4;
    itemsPerPage: number;
    showPrice: boolean;
    showDescription: boolean;
    backgroundColor?: string;
  };
  content: {
    productIds: string[];
  };
}

export interface CategoryShowcaseSection {
  type: 'category-showcase';
  settings: {
    title: string;
    columns: 2 | 3 | 4;
    layout: 'grid' | 'list';
    backgroundColor?: string;
    showCount: boolean;
  };
  content: {
    categoryIds: string[];
  };
}

export interface ProductGridSection {
  type: 'product-grid';
  settings: {
    title: string;
    columns: 1 | 2 | 3 | 4;
    displayMode: 'grid' | 'list';
    sortBy: 'default' | 'alphabetical' | 'price-low' | 'price-high' | 'newest';
    itemsToShow: number;
    showFilters: boolean;
    showSearch: boolean;
    backgroundColor?: string;
  };
  content: {
    categoryId?: string;
    productIds?: string[];
  };
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

export type HomepageSection =
  | CarouselSection
  | TextSection
  | ImageSection
  | BannerSection
  | FeaturedProductsSection
  | CategoryShowcaseSection
  | ProductGridSection
  | AnnouncementSection
  | CTASection
  | VideoSection
  | TestimonialsSection
  | FooterSection
  | FeatureCardSection
  | TwoColumnContentSection
  | ContentGridSection;

export interface ThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  accentColor?: string;
}

export interface HomepageLayout {
  sections: Array<HomepageSection & { id: string; order: number }>;
  theme: ThemeSettings;
}

export interface HomepageConfig {
  id: string;
  storeId: string;
  layout: HomepageLayout;
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
    | 'UNDO'
    | 'REDO';
  payload?: any;
}
