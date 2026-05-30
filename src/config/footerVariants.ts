import { v4 as uuid } from 'uuid';
import type { WebsiteFooterVariant, WebsiteNavItem, WebsiteSiteSettings } from '../types/homepage';

function footerLink(label: string, href: string): WebsiteNavItem {
  return { id: uuid(), label, href };
}

/** Default Shop / Customer care / Legal columns for new sites and templates. */
export function createDefaultFooterLinkColumns(): Array<{ title: string; links: WebsiteNavItem[] }> {
  return [
    {
      title: 'Shop',
      links: [
        footerLink('All products', '/collections/all'),
        footerLink('Collections', '/collections/all'),
      ],
    },
    {
      title: 'Customer care',
      links: [
        footerLink('Contact', '#'),
        footerLink('Shipping', '#'),
        footerLink('Returns', '#'),
      ],
    },
    {
      title: 'Legal',
      links: [
        footerLink('Privacy policy', '#'),
        footerLink('Terms & conditions', '#'),
      ],
    },
  ];
}

export const FOOTER_COLUMN_PRESETS: Array<{ id: string; title: string; links: Array<{ label: string; href: string }> }> = [
  {
    id: 'shop',
    title: 'Shop',
    links: [
      { label: 'All products', href: '/collections/all' },
      { label: 'Collections', href: '/collections/all' },
    ],
  },
  {
    id: 'care',
    title: 'Customer care',
    links: [
      { label: 'Contact', href: '#' },
      { label: 'Shipping', href: '#' },
      { label: 'Returns', href: '#' },
      { label: 'FAQs', href: '#' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '#' },
      { label: 'Terms & conditions', href: '#' },
      { label: 'Refund policy', href: '#' },
    ],
  },
];

/** Structural layout driven by footer style — not colors or fonts. */
export type FooterLayoutMode = 'info-cards' | 'link-columns' | 'centered' | 'split';

export const FOOTER_VARIANT_OPTIONS: Array<{ id: WebsiteFooterVariant; label: string; description: string }> = [
  {
    id: 'classic',
    label: 'Info cards',
    description: 'Store name on top, then Location / Contact / Store info in cards',
  },
  {
    id: 'clean',
    label: 'Link columns',
    description: 'Shop-style link columns with your brand and social on the side',
  },
  {
    id: 'aurora',
    label: 'Centered',
    description: 'Centered store name and tagline, link columns below',
  },
  {
    id: 'pulse',
    label: 'Split bar',
    description: 'One row: brand on the left, link columns in the middle, social on the right',
  },
];

export function footerLayoutForVariant(variant: WebsiteFooterVariant): FooterLayoutMode {
  switch (variant) {
    case 'clean':
      return 'link-columns';
    case 'aurora':
      return 'centered';
    case 'pulse':
      return 'split';
    case 'classic':
    default:
      return 'info-cards';
  }
}

/** Layout structure and section visibility only — colors stay in the Colors panel. */
export function footerPresetForVariant(variant: WebsiteFooterVariant): Partial<WebsiteSiteSettings> {
  const layout = footerLayoutForVariant(variant);
  switch (layout) {
    case 'link-columns':
      return {
        footerVariant: variant,
        footerShowOpenBadge: false,
        footerOpenBadgeLabel: 'Open now',
        footerShowLocation: false,
        footerShowContact: false,
        footerShowStoreInfo: false,
        footerShowFollow: true,
      };
    case 'centered':
      return {
        footerVariant: variant,
        footerShowOpenBadge: true,
        footerOpenBadgeLabel: 'Open now',
        footerShowLocation: false,
        footerShowContact: false,
        footerShowStoreInfo: false,
        footerShowFollow: true,
      };
    case 'split':
      return {
        footerVariant: variant,
        footerShowOpenBadge: true,
        footerOpenBadgeLabel: 'Open now',
        footerShowLocation: false,
        footerShowContact: false,
        footerShowStoreInfo: false,
        footerShowFollow: true,
      };
    case 'info-cards':
    default:
      return {
        footerVariant: variant,
        footerShowOpenBadge: true,
        footerOpenBadgeLabel: 'Open now',
        footerShowLocation: true,
        footerShowContact: true,
        footerShowStoreInfo: true,
        footerShowFollow: true,
      };
  }
}

/** Optional color starting points when user taps “Reset to style defaults”. */
export function footerColorPresetForVariant(variant: WebsiteFooterVariant): Partial<WebsiteSiteSettings> {
  switch (variant) {
    case 'aurora':
      return {
        footerBg: '#3b3026',
        footerTextColor: '#ede0d4',
        footerColBg: 'rgba(255, 255, 255, 0.07)',
        footerAccentColor: '#b08968',
        footerAccentBg: 'rgba(176, 137, 104, 0.18)',
        footerBorderColor: 'rgba(237, 224, 212, 0.12)',
      };
    case 'pulse':
      return {
        footerBg: '#060912',
        footerTextColor: '#e2e8f0',
        footerColBg: 'rgba(37, 99, 235, 0.12)',
        footerAccentColor: '#60a5fa',
        footerAccentBg: 'rgba(37, 99, 235, 0.2)',
        footerBorderColor: 'rgba(148, 163, 184, 0.2)',
      };
    case 'clean':
      return {
        footerBg: '#ffffff',
        footerTextColor: '#374151',
        footerColBg: '#f9fafb',
        footerAccentColor: '#111827',
        footerAccentBg: '#f3f4f6',
        footerBorderColor: 'rgba(0, 0, 0, 0.06)',
      };
    case 'classic':
    default:
      return {
        footerBg: '#ffffff',
        footerTextColor: '#1a1a1a',
        footerColBg: '#f2f2f0',
        footerAccentColor: '#1a6b4a',
        footerAccentBg: '#e8f4ef',
        footerBorderColor: 'rgba(0, 0, 0, 0.08)',
      };
  }
}

/** Map website template id → default footer layout variant */
export function footerVariantForTemplate(templateId: string): WebsiteFooterVariant {
  if (templateId === 'aurora-boutique') return 'aurora';
  if (templateId === 'pulse-tech') return 'pulse';
  if (templateId === 'clean-market') return 'clean';
  return 'classic';
}
