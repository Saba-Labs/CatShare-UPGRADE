import type { CSSProperties } from 'react';
import type { ThemeSettings } from '../types/homepage';

/** CSS custom properties for website template theming (storefront + checkout). */
export function buildWebsiteThemeVars(theme?: ThemeSettings): CSSProperties {
  const t = theme || {};
  const vars: Record<string, string> = {
    '--site-primary': t.primaryColor || '#1a73e8',
    '--site-secondary': t.secondaryColor || '#e8f0fe',
    '--site-accent': t.accentColor || t.primaryColor || '#1a73e8',
    '--site-text': t.textColor || '#202124',
    '--site-bg': t.backgroundColor || '#ffffff',
    '--site-on-primary': '#ffffff',
    '--site-radius': t.buttonStyle === 'soft' ? '999px' : '10px',
  };
  if (t.fontFamily) {
    vars['--site-font'] = t.fontFamily;
    vars['--site-font-head'] = t.headingFontFamily || t.fontFamily;
  } else if (t.headingFontFamily) {
    vars['--site-font-head'] = t.headingFontFamily;
  }
  return vars as CSSProperties;
}
