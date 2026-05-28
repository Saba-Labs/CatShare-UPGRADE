import { ThemeSettings } from '../types/homepage';

export function getThemeButtonStyles(theme: ThemeSettings, overrideColor?: string) {
  const primary = overrideColor || theme.primaryColor || '#1a73e8';
  const style = theme.buttonStyle || 'solid';

  if (style === 'outline') {
    return {
      background: 'transparent',
      color: primary,
      border: `2px solid ${primary}`,
    };
  }

  if (style === 'soft') {
    return {
      background: theme.secondaryColor || '#e8f0fe',
      color: primary,
      border: 'none',
    };
  }

  return {
    background: primary,
    color: '#ffffff',
    border: 'none',
  };
}
