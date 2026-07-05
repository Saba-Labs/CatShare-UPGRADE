import type { CSSProperties } from 'react';
import type { WebsiteSiteSettings } from '../types/homepage';
import { headerLayoutForVariant, type HeaderLayoutMode } from '../config/headerVariants';

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, '');
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  if (raw.length === 6) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function buildHeaderSurfaceStyle(
  siteSettings: WebsiteSiteSettings,
  options: { scrolled: boolean; layout?: HeaderLayoutMode; heroOverlay?: boolean; /** @deprecated */ immersiveOverHero?: boolean }
): CSSProperties {
  const layout = options.layout ?? headerLayoutForVariant(siteSettings.headerVariant);
  const headerBg = siteSettings.headerBg || '#ffffff';
  const heroOverlay = options.heroOverlay ?? options.immersiveOverHero ?? false;
  const floatingOpacity = siteSettings.headerFloatingOpacity ?? 0.92;
  const immersiveOpacity = siteSettings.headerImmersiveOpacity ?? 0;
  const floatingBlur = siteSettings.headerFloatingBlur ?? 12;

  let background = headerBg;
  if (layout === 'floating' && !options.scrolled) {
    background = 'transparent';
  } else if (layout === 'immersive' && !options.scrolled) {
    background = heroOverlay
      ? immersiveOpacity > 0
        ? rgbaFromHex(headerBg, immersiveOpacity)
        : 'transparent'
      : headerBg;
  }

  let barBg = headerBg;
  if (layout === 'floating' && !options.scrolled) {
    barBg = rgbaFromHex(headerBg, floatingOpacity);
  } else if (layout === 'immersive' && !options.scrolled && heroOverlay) {
    barBg = 'transparent';
  }

  return {
    background,
    color: siteSettings.headerTextColor || '#111827',
    ['--header-bg' as string]: headerBg,
    ['--header-bar-bg' as string]: barBg,
    ['--header-floating-blur' as string]: `${floatingBlur}px`,
  };
}

export function headerLayoutDataAttributes(
  siteSettings: WebsiteSiteSettings,
  layoutOverride?: HeaderLayoutMode
): Record<string, string | undefined> {
  const layout = layoutOverride ?? headerLayoutForVariant(siteSettings.headerVariant);
  const attrs: Record<string, string | undefined> = {};

  if (layout === 'classic') {
    attrs['data-classic-border'] = siteSettings.headerClassicBorder === false ? 'false' : 'true';
  }
  if (layout === 'centered') {
    attrs['data-centered-gap'] = siteSettings.headerCenteredGap || 'normal';
    attrs['data-centered-logo-size'] = siteSettings.headerCenteredLogoSize || 'medium';
    attrs['data-centered-brand-layout'] = siteSettings.headerCenteredBrandLayout || 'logo-beside';
  }
  if (layout === 'floating') {
    attrs['data-floating-radius'] = siteSettings.headerFloatingRadius || 'round';
  }
  if (layout === 'immersive') {
    attrs['data-immersive-text-shadow'] =
      siteSettings.headerImmersiveTextShadow !== false ? 'true' : 'false';
  }
  if (layout === 'orderform') {
    attrs['data-hero-padding'] = siteSettings.headerHeroPadding || 'comfortable';
  }

  return attrs;
}
