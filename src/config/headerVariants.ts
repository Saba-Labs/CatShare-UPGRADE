import type { WebsiteHeaderVariant, WebsiteSiteSettings } from '../types/homepage';

/** Structural header layout — not colors or fonts. */
export type HeaderLayoutMode = 'classic' | 'centered' | 'floating' | 'immersive' | 'orderform';

const LEGACY_HEADER_VARIANT_MAP: Record<string, WebsiteHeaderVariant> = {
  minimal: 'classic',
  split: 'classic',
};

export const HEADER_VARIANT_OPTIONS: Array<{ id: WebsiteHeaderVariant; label: string; description: string }> = [
  {
    id: 'classic',
    label: 'Classic bar',
    description: 'Logo on the left, menu links on the right (hamburger on mobile)',
  },
  {
    id: 'centered',
    label: 'Centered bar',
    description: 'Logo centered on top, navigation links in a row below',
  },
  {
    id: 'floating',
    label: 'Floating bar',
    description: 'Rounded pill bar with inset margins — overlays hero images at the top of the homepage',
  },
  {
    id: 'immersive',
    label: 'Immersive bar',
    description: 'Transparent bar over hero images at the top of the homepage — solid background after you scroll',
  },
  {
    id: 'orderform',
    label: 'Store hero (OrderForm)',
    description: 'Large store name and tagline like the default catalog — no top menu bar',
  },
];

/** Map saved values (including removed minimal/split) to a supported header layout. */
export function normalizeHeaderVariant(variant: string | undefined): WebsiteHeaderVariant {
  if (!variant) return 'classic';
  if (variant in LEGACY_HEADER_VARIANT_MAP) {
    return LEGACY_HEADER_VARIANT_MAP[variant];
  }
  if (
    variant === 'classic' ||
    variant === 'centered' ||
    variant === 'floating' ||
    variant === 'immersive' ||
    variant === 'orderform'
  ) {
    return variant;
  }
  return 'classic';
}

export function isOverlayHeaderLayout(layout: HeaderLayoutMode): boolean {
  return layout === 'floating' || layout === 'immersive';
}

export function headerLayoutForVariant(variant: string | undefined): HeaderLayoutMode {
  switch (normalizeHeaderVariant(variant)) {
    case 'centered':
      return 'centered';
    case 'floating':
      return 'floating';
    case 'immersive':
      return 'immersive';
    case 'orderform':
      return 'orderform';
    case 'classic':
    default:
      return 'classic';
  }
}

/** Inner storefront pages use the large store hero when that layout is configured; other layouts use the classic top bar. */
export function headerLayoutForPageSurface(
  variant: string | undefined,
  surface: 'homepage' | 'inner' = 'homepage'
): HeaderLayoutMode {
  if (surface === 'inner' && normalizeHeaderVariant(variant) !== 'orderform') return 'classic';
  return headerLayoutForVariant(variant);
}

/** Layout only — colors stay in the Colors section. */
export function headerLayoutDefaultsForVariant(variant: WebsiteHeaderVariant): Partial<WebsiteSiteSettings> {
  switch (variant) {
    case 'centered':
      return {
        headerCenteredGap: 'normal',
        headerCenteredLogoSize: 'medium',
        headerCenteredBrandLayout: 'logo-beside',
      };
    case 'floating':
      return {
        headerFloatingOpacity: 0.92,
        headerFloatingBlur: 12,
        headerFloatingRadius: 'round',
      };
    case 'immersive':
      return { headerImmersiveOpacity: 0, headerImmersiveTextShadow: true };
    case 'orderform':
      return { headerHeroPadding: 'comfortable' };
    case 'classic':
    default:
      return { headerClassicBorder: true };
  }
}

/** Layout only — colors stay in the Colors section. */
export function headerPresetForVariant(variant: WebsiteHeaderVariant): Partial<WebsiteSiteSettings> {
  return { headerVariant: variant, ...headerLayoutDefaultsForVariant(variant) };
}

/** Optional palette when user taps “Reset to style defaults”. */
export function headerColorPresetForVariant(variant: WebsiteHeaderVariant): Partial<WebsiteSiteSettings> {
  switch (variant) {
    case 'centered':
      return {
        headerBg: '#fdfaf6',
        headerTextColor: '#3b3026',
      };
    case 'floating':
      return {
        headerBg: '#ffffff',
        headerTextColor: '#111827',
      };
    case 'immersive':
      return {
        headerBg: '#ffffff',
        headerTextColor: '#111827',
      };
    case 'orderform':
      return {
        headerBg: '#f7f7f5',
        headerTextColor: '#1a1a1a',
      };
    case 'classic':
    default:
      return {
        headerBg: '#ffffff',
        headerTextColor: '#111827',
      };
  }
}

export function headerVariantForTemplate(templateId: string): WebsiteHeaderVariant {
  if (templateId === 'aurora-boutique') return 'centered';
  if (templateId === 'pulse-tech') return 'floating';
  if (templateId === 'clean-market') return 'classic';
  if (templateId === 'default-store') return 'orderform';
  if (templateId === 'studio-commerce') return 'classic';
  if (templateId === 'fashion-wardrobe' || templateId === 'fashion-boutique-list') return 'orderform';
  if (templateId === 'fashion-linen' || templateId === 'jewel-pearl') return 'classic';
  if (templateId === 'fashion-runway' || templateId === 'jewel-apex') return 'floating';
  if (templateId === 'fashion-maharani' || templateId === 'jewel-royal') return 'centered';
  if (templateId === 'jewel-tray' || templateId === 'jewel-counter') return 'orderform';
  return 'classic';
}
