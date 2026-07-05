import type { CSSProperties } from 'react';
import type { ThemeSettings } from '../types/homepage';
import { getThemeButtonStyles } from './themeButtonStyles';

export type BuilderButtonShadow = 'none' | 'soft' | 'medium' | 'strong';
export type BuilderButtonRadius = 'theme' | 'sharp' | 'round' | 'pill';

export interface BuilderButtonStyleSettings {
  buttonStyle?: 'solid' | 'outline' | 'soft';
  buttonColor?: string;
  buttonShadow?: BuilderButtonShadow;
  buttonRadius?: BuilderButtonRadius;
}

const SHADOW_MAP: Record<BuilderButtonShadow, string | undefined> = {
  none: 'none',
  soft: '0 2px 8px rgba(15, 23, 42, 0.12)',
  medium: '0 6px 20px rgba(15, 23, 42, 0.16)',
  strong: '0 10px 32px rgba(15, 23, 42, 0.22)',
};

const RADIUS_MAP: Record<BuilderButtonRadius, string | undefined> = {
  theme: undefined,
  sharp: '4px',
  round: '8px',
  pill: '999px',
};

export function sectionHasButtonStyleControls(sectionType: string): boolean {
  return sectionType === 'banner' || sectionType === 'cta' || sectionType === 'feature-card';
}

export function getBuilderButtonStyles(
  settings: BuilderButtonStyleSettings | undefined,
  theme: ThemeSettings
): CSSProperties {
  const color = settings?.buttonColor;
  const variant = settings?.buttonStyle || theme.buttonStyle || 'solid';
  const base = getThemeButtonStyles({ ...theme, buttonStyle: variant }, color);
  const shadow = SHADOW_MAP[settings?.buttonShadow || 'soft'];
  const radius = RADIUS_MAP[settings?.buttonRadius || 'theme'];

  return {
    ...base,
    ...(shadow ? { boxShadow: shadow } : {}),
    ...(radius ? { borderRadius: radius } : {}),
  };
}
