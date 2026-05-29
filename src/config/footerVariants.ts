import type { WebsiteFooterVariant, WebsiteSiteSettings } from '../types/homepage';

export const FOOTER_VARIANT_OPTIONS: Array<{ id: WebsiteFooterVariant; label: string; description: string }> = [
  { id: 'classic', label: 'Classic', description: 'Light card with four info blocks' },
  { id: 'aurora', label: 'Aurora', description: 'Warm editorial footer with quick links' },
  { id: 'pulse', label: 'Pulse', description: 'Dark tech footer with glow accent' },
  { id: 'clean', label: 'Clean', description: 'Minimal two-column footer' },
];

export function footerPresetForVariant(variant: WebsiteFooterVariant): Partial<WebsiteSiteSettings> {
  switch (variant) {
    case 'aurora':
      return {
        footerVariant: 'aurora',
        footerBg: '#3b3026',
        footerTextColor: '#ede0d4',
        footerColBg: 'rgba(255, 255, 255, 0.07)',
        footerAccentColor: '#b08968',
        footerAccentBg: 'rgba(176, 137, 104, 0.18)',
        footerBorderColor: 'rgba(237, 224, 212, 0.12)',
        footerShowOpenBadge: true,
        footerOpenBadgeLabel: 'Boutique open',
        footerShowLocation: true,
        footerShowContact: true,
        footerShowStoreInfo: true,
        footerShowFollow: true,
        footerCopyright: '© {year} — Crafted with care',
      };
    case 'pulse':
      return {
        footerVariant: 'pulse',
        footerBg: '#060912',
        footerTextColor: '#e2e8f0',
        footerColBg: 'rgba(37, 99, 235, 0.12)',
        footerAccentColor: '#60a5fa',
        footerAccentBg: 'rgba(37, 99, 235, 0.2)',
        footerBorderColor: 'rgba(148, 163, 184, 0.2)',
        footerShowOpenBadge: true,
        footerOpenBadgeLabel: 'Support online',
        footerShowLocation: true,
        footerShowContact: true,
        footerShowStoreInfo: true,
        footerShowFollow: true,
        footerCopyright: 'Powered by CatShare · Pulse storefront',
      };
    case 'clean':
      return {
        footerVariant: 'clean',
        footerBg: '#ffffff',
        footerTextColor: '#374151',
        footerColBg: '#f9fafb',
        footerAccentColor: '#111827',
        footerAccentBg: '#f3f4f6',
        footerBorderColor: 'rgba(0, 0, 0, 0.06)',
        footerShowOpenBadge: false,
        footerOpenBadgeLabel: 'Open now',
        footerShowLocation: false,
        footerShowContact: true,
        footerShowStoreInfo: true,
        footerShowFollow: true,
        footerCopyright: 'Powered by CatShare storefront',
      };
    case 'classic':
    default:
      return {
        footerVariant: 'classic',
        footerBg: '#ffffff',
        footerTextColor: '#1a1a1a',
        footerColBg: '#f2f2f0',
        footerAccentColor: '#1a6b4a',
        footerAccentBg: '#e8f4ef',
        footerBorderColor: 'rgba(0, 0, 0, 0.08)',
        footerShowOpenBadge: true,
        footerOpenBadgeLabel: 'Open now',
        footerShowLocation: true,
        footerShowContact: true,
        footerShowStoreInfo: true,
        footerShowFollow: true,
        footerCopyright: '',
      };
  }
}

/** Map website template id → default footer variant */
export function footerVariantForTemplate(templateId: string): WebsiteFooterVariant {
  if (templateId === 'aurora-boutique') return 'aurora';
  if (templateId === 'pulse-tech') return 'pulse';
  if (templateId === 'clean-market') return 'clean';
  return 'classic';
}
