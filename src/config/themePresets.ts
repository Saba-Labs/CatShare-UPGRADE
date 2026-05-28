import { ThemeSettings } from '../types/homepage';

export interface ThemePreset {
  id: string;
  name: string;
  swatch: string;
  theme: ThemeSettings;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic-blue',
    name: 'Classic Blue',
    swatch: '#1a73e8',
    theme: {
      primaryColor: '#1a73e8',
      secondaryColor: '#e8f0fe',
      backgroundColor: '#ffffff',
      textColor: '#202124',
      accentColor: '#d93025',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    swatch: '#111827',
    theme: {
      primaryColor: '#111827',
      secondaryColor: '#f3f4f6',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      accentColor: '#f59e0b',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
  {
    id: 'warm-boutique',
    name: 'Warm Boutique',
    swatch: '#b45309',
    theme: {
      primaryColor: '#b45309',
      secondaryColor: '#fef3c7',
      backgroundColor: '#fffbeb',
      textColor: '#422006',
      accentColor: '#15803d',
      fontFamily: "Georgia, 'Times New Roman', serif",
      buttonStyle: 'outline',
    },
  },
  {
    id: 'minimal-mono',
    name: 'Minimal',
    swatch: '#000000',
    theme: {
      primaryColor: '#000000',
      secondaryColor: '#f5f5f5',
      backgroundColor: '#ffffff',
      textColor: '#171717',
      accentColor: '#525252',
      fontFamily: "system-ui, -apple-system, sans-serif",
      buttonStyle: 'outline',
    },
  },
  {
    id: 'fresh-green',
    name: 'Fresh Green',
    swatch: '#059669',
    theme: {
      primaryColor: '#059669',
      secondaryColor: '#d1fae5',
      backgroundColor: '#ffffff',
      textColor: '#064e3b',
      accentColor: '#0d9488',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'soft',
    },
  },
];

export const FONT_FAMILY_OPTIONS = [
  { value: "'DM Sans', system-ui, sans-serif", label: 'DM Sans' },
  { value: "system-ui, -apple-system, sans-serif", label: 'System' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Serif' },
  { value: "'Courier New', monospace", label: 'Mono' },
];

export const BUTTON_STYLE_OPTIONS: Array<{ value: NonNullable<ThemeSettings['buttonStyle']>; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'outline', label: 'Outline' },
  { value: 'soft', label: 'Soft' },
];
