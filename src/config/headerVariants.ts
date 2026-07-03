import type { WebsiteHeaderVariant, WebsiteSiteSettings } from '../types/homepage';

/** Structural header layout — not colors or fonts. */
export type HeaderLayoutMode = 'classic' | 'centered' | 'minimal' | 'split' | 'orderform';

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
    id: 'minimal',
    label: 'Minimal bar',
    description: 'Logo only in the bar — links open from the menu button',
  },
  {
    id: 'split',
    label: 'Split bar',
    description: 'Logo left, links centered in the middle, menu button on the right',
  },
  {
    id: 'orderform',
    label: 'Store hero (OrderForm)',
    description: 'Large store name and tagline like the default catalog — no top menu bar',
  },
];

export function headerLayoutForVariant(variant: WebsiteHeaderVariant): HeaderLayoutMode {
  switch (variant) {
    case 'centered':
      return 'centered';
    case 'minimal':
      return 'minimal';
    case 'split':
      return 'split';
    case 'orderform':
      return 'orderform';
    case 'classic':
    default:
      return 'classic';
  }
}

/** Layout only — colors stay in the Colors section. */
export function headerPresetForVariant(variant: WebsiteHeaderVariant): Partial<WebsiteSiteSettings> {
  return { headerVariant: variant };
}

/** Optional palette when user taps “Reset to style defaults”. */
export function headerColorPresetForVariant(variant: WebsiteHeaderVariant): Partial<WebsiteSiteSettings> {
  switch (variant) {
    case 'centered':
      return {
        headerBg: '#fdfaf6',
        headerTextColor: '#3b3026',
      };
    case 'minimal':
      return {
        headerBg: '#ffffff',
        headerTextColor: '#111827',
      };
    case 'split':
      return {
        headerBg: '#0b1120',
        headerTextColor: '#e2e8f0',
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
  if (templateId === 'pulse-tech') return 'split';
  if (templateId === 'clean-market') return 'minimal';
  if (templateId === 'default-store') return 'orderform';
  if (templateId === 'studio-commerce') return 'classic';
  if (templateId === 'fashion-wardrobe' || templateId === 'fashion-boutique-list') return 'orderform';
  if (templateId === 'fashion-linen' || templateId === 'jewel-pearl') return 'minimal';
  if (templateId === 'fashion-runway' || templateId === 'jewel-apex') return 'split';
  if (templateId === 'fashion-maharani' || templateId === 'jewel-royal') return 'centered';
  if (templateId === 'jewel-tray' || templateId === 'jewel-counter') return 'orderform';
  return 'classic';
}
