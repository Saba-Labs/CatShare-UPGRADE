import type { CSSProperties } from 'react';
import { ThemeSettings } from '../types/homepage';

export const SITES_THEME_BUTTON_CLASS = 'sites-theme-btn';

const BASE_BUTTON: CSSProperties = {
  display: 'inline-block',
  marginTop: '4px',
  padding: '12px 28px',
  borderRadius: '8px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  lineHeight: 1.25,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  border: 'none',
  boxSizing: 'border-box',
  transition: 'filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
};

export function getThemeButtonStyles(theme: ThemeSettings, overrideColor?: string): CSSProperties {
  const primary = overrideColor || theme.primaryColor || '#1a73e8';
  const style = theme.buttonStyle || 'solid';

  if (style === 'outline') {
    return {
      ...BASE_BUTTON,
      background: 'transparent',
      color: primary,
      border: `2px solid ${primary}`,
      padding: '10px 26px',
    };
  }

  if (style === 'soft') {
    return {
      ...BASE_BUTTON,
      background: theme.secondaryColor || '#e8f0fe',
      color: primary,
      border: 'none',
    };
  }

  return {
    ...BASE_BUTTON,
    background: primary,
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
  };
}
