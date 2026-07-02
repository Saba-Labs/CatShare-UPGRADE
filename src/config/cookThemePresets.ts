import type { ThemeSettings } from '../types/homepage';
import type { ThemePreset } from './themePresets';

export interface CookFontOption {
  id: string;
  label: string;
  concept: string;
  value: string;
  sampleLine: string;
  googleFamily: string;
}

/** Fonts for Cook a Theme — each targets a distinct store personality. */
export const COOK_FONT_OPTIONS: CookFontOption[] = [
  {
    id: 'dm-sans',
    label: 'DM Sans',
    concept: 'Clean commerce',
    value: "'DM Sans', system-ui, sans-serif",
    sampleLine: 'Shop the collection',
    googleFamily: 'DM+Sans',
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    concept: 'Luxury fashion',
    value: "'Playfair Display', Georgia, serif",
    sampleLine: 'Curated for you',
    googleFamily: 'Playfair+Display',
  },
  {
    id: 'inter',
    label: 'Inter',
    concept: 'Tech & gadgets',
    value: "'Inter', system-ui, sans-serif",
    sampleLine: 'Upgrade your setup',
    googleFamily: 'Inter',
  },
  {
    id: 'lora',
    label: 'Lora',
    concept: 'Editorial story',
    value: "'Lora', Georgia, serif",
    sampleLine: 'Our story begins',
    googleFamily: 'Lora',
  },
  {
    id: 'oswald',
    label: 'Oswald',
    concept: 'Bold streetwear',
    value: "'Oswald', system-ui, sans-serif",
    sampleLine: 'Drop now — limited run',
    googleFamily: 'Oswald',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    concept: 'Trusted classics',
    value: "'Merriweather', Georgia, serif",
    sampleLine: 'Quality you can feel',
    googleFamily: 'Merriweather',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    concept: 'Friendly D2C',
    value: "'Poppins', system-ui, sans-serif",
    sampleLine: 'Happy shopping starts here',
    googleFamily: 'Poppins',
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    concept: 'Fine boutique',
    value: "'Cormorant Garamond', Georgia, serif",
    sampleLine: 'Handpicked elegance',
    googleFamily: 'Cormorant+Garamond',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    concept: 'Futuristic minimal',
    value: "'Space Grotesk', system-ui, sans-serif",
    sampleLine: 'Next-gen essentials',
    googleFamily: 'Space+Grotesk',
  },
  {
    id: 'nunito',
    label: 'Nunito',
    concept: 'Soft lifestyle',
    value: "'Nunito', system-ui, sans-serif",
    sampleLine: 'Everyday comfort',
    googleFamily: 'Nunito',
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    concept: 'Artisan craft',
    value: "'Fraunces', Georgia, serif",
    sampleLine: 'Made with intention',
    googleFamily: 'Fraunces',
  },
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    concept: 'Startup fresh',
    value: "'Plus Jakarta Sans', system-ui, sans-serif",
    sampleLine: 'Launch your favorites',
    googleFamily: 'Plus+Jakarta+Sans',
  },
];

/** Color palettes for Cook a Theme — 12 distinct brand moods. */
export const COOK_COLOR_PRESETS: ThemePreset[] = [
  {
    id: 'cook-classic-blue',
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
    id: 'cook-modern-dark',
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
    id: 'cook-warm-boutique',
    name: 'Warm Boutique',
    swatch: '#b45309',
    theme: {
      primaryColor: '#b45309',
      secondaryColor: '#fef3c7',
      backgroundColor: '#fffbeb',
      textColor: '#422006',
      accentColor: '#15803d',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'outline',
    },
  },
  {
    id: 'cook-minimal-mono',
    name: 'Minimal Mono',
    swatch: '#171717',
    theme: {
      primaryColor: '#171717',
      secondaryColor: '#f5f5f5',
      backgroundColor: '#ffffff',
      textColor: '#171717',
      accentColor: '#525252',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'outline',
    },
  },
  {
    id: 'cook-fresh-green',
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
  {
    id: 'cook-sunset-coral',
    name: 'Sunset Coral',
    swatch: '#e07a5f',
    theme: {
      primaryColor: '#e07a5f',
      secondaryColor: '#fde8e4',
      backgroundColor: '#fffaf8',
      textColor: '#3d2c29',
      accentColor: '#f4a261',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
  {
    id: 'cook-midnight-navy',
    name: 'Midnight Navy',
    swatch: '#1e3a5f',
    theme: {
      primaryColor: '#1e3a5f',
      secondaryColor: '#e8eef5',
      backgroundColor: '#f8fafc',
      textColor: '#0f172a',
      accentColor: '#3b82f6',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
  {
    id: 'cook-lavender-dream',
    name: 'Lavender Dream',
    swatch: '#7c3aed',
    theme: {
      primaryColor: '#7c3aed',
      secondaryColor: '#ede9fe',
      backgroundColor: '#faf5ff',
      textColor: '#3b0764',
      accentColor: '#a78bfa',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'soft',
    },
  },
  {
    id: 'cook-earth-terracotta',
    name: 'Earth Terracotta',
    swatch: '#9c6644',
    theme: {
      primaryColor: '#9c6644',
      secondaryColor: '#ede0d4',
      backgroundColor: '#fdfaf6',
      textColor: '#3b3026',
      accentColor: '#b08968',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'outline',
    },
  },
  {
    id: 'cook-electric-cyan',
    name: 'Electric Cyan',
    swatch: '#0891b2',
    theme: {
      primaryColor: '#0891b2',
      secondaryColor: '#cffafe',
      backgroundColor: '#ffffff',
      textColor: '#164e63',
      accentColor: '#22d3ee',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
  {
    id: 'cook-rose-blush',
    name: 'Rose Blush',
    swatch: '#db2777',
    theme: {
      primaryColor: '#db2777',
      secondaryColor: '#fce7f3',
      backgroundColor: '#fffbfb',
      textColor: '#500724',
      accentColor: '#f472b6',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'soft',
    },
  },
  {
    id: 'cook-forest-moss',
    name: 'Forest Moss',
    swatch: '#3f6212',
    theme: {
      primaryColor: '#3f6212',
      secondaryColor: '#ecfccb',
      backgroundColor: '#f7fee7',
      textColor: '#1a2e05',
      accentColor: '#65a30d',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'outline',
    },
  },
  {
    id: 'cook-charcoal-luxe',
    name: 'Charcoal Luxe',
    swatch: '#121212',
    theme: {
      primaryColor: '#121212',
      secondaryColor: '#f6f6f6',
      backgroundColor: '#ffffff',
      textColor: '#121212',
      accentColor: '#c9a227',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
  {
    id: 'cook-ocean-teal',
    name: 'Ocean Teal',
    swatch: '#0f766e',
    theme: {
      primaryColor: '#0f766e',
      secondaryColor: '#ccfbf1',
      backgroundColor: '#f0fdfa',
      textColor: '#134e4a',
      accentColor: '#14b8a6',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'solid',
    },
  },
];

export const COOK_COLOR_CONCEPTS: Record<string, string> = {
  'cook-classic-blue': 'Trust & clarity',
  'cook-modern-dark': 'Urban premium',
  'cook-warm-boutique': 'Cozy retail',
  'cook-minimal-mono': 'Gallery clean',
  'cook-fresh-green': 'Natural wellness',
  'cook-sunset-coral': 'Warm lifestyle',
  'cook-midnight-navy': 'Professional',
  'cook-lavender-dream': 'Beauty & care',
  'cook-earth-terracotta': 'Handmade feel',
  'cook-electric-cyan': 'Tech energy',
  'cook-rose-blush': 'Feminine chic',
  'cook-forest-moss': 'Outdoor organic',
  'cook-charcoal-luxe': 'Studio commerce',
  'cook-ocean-teal': 'Coastal calm',
};

export function cookThemeGoogleFontsHref(): string {
  const families = COOK_FONT_OPTIONS.map((f) => `family=${f.googleFamily}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
