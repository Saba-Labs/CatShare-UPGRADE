import type { IconType } from 'react-icons';
import {
  FiPlus,
  FiLayout,
  FiFile,
  FiDroplet,
  FiSettings,
  FiType,
  FiImage,
  FiFilm,
  FiStar,
  FiGrid,
  FiColumns,
  FiSquare,
  FiMinus,
  FiHelpCircle,
  FiCode,
  FiMessageSquare,
  FiArrowRight,
  FiBell,
  FiShoppingBag,
  FiLayers,
  FiHome,
  FiMail,
  FiZap,
  FiInfo,
  FiChevronUp,
  FiChevronDown,
  FiTrash2,
  FiArrowLeft,
  FiLink,
  FiGlobe,
  FiSearch,
  FiAlignLeft,
  FiBox,
  FiSliders,
} from 'react-icons/fi';
import type { HomepageSectionType } from '../../types/homepage';
import type { BlockPresetId } from '../../config/blockPresets';
import type { SidebarTab } from './BuilderSidebar';

export const SIDEBAR_TAB_META: Record<
  SidebarTab,
  { label: string; hint: string; Icon: IconType }
> = {
  insert: { label: 'Insert', hint: 'Add blocks & layouts', Icon: FiPlus },
  templates: { label: 'Templates', hint: 'Site starters', Icon: FiLayout },
  pages: { label: 'Pages', hint: 'Manage pages', Icon: FiFile },
  photos: { label: 'Photos', hint: 'Image library', Icon: FiImage },
  theme: { label: 'Theme', hint: 'Colors & fonts', Icon: FiDroplet },
  site: { label: 'Site', hint: 'Logo, nav & SEO', Icon: FiSettings },
};

export const PRESET_ICONS: Record<BlockPresetId, IconType> = {
  hero: FiZap,
  about: FiInfo,
  contact: FiMail,
  storefront: FiShoppingBag,
};

export const SECTION_ICONS: Partial<Record<HomepageSectionType, IconType>> = {
  carousel: FiLayers,
  text: FiType,
  image: FiImage,
  banner: FiSquare,
  'featured-products': FiStar,
  'category-showcase': FiGrid,
  'product-grid': FiBox,
  announcement: FiBell,
  cta: FiArrowRight,
  video: FiFilm,
  testimonials: FiMessageSquare,
  'feature-card': FiSquare,
  'two-column-content': FiColumns,
  'content-grid': FiGrid,
  divider: FiMinus,
  faq: FiHelpCircle,
  embed: FiCode,
  footer: FiAlignLeft,
};

export {
  FiPlus,
  FiHome,
  FiFile,
  FiLayers,
  FiGrid,
  FiShoppingBag,
  FiBell,
  FiAlignLeft,
  FiSettings,
  FiChevronUp,
  FiChevronDown,
  FiTrash2,
  FiArrowLeft,
  FiLink,
  FiGlobe,
  FiSearch,
  FiType,
  FiDroplet,
  FiImage,
  FiSliders,
};
