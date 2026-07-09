/**
 * Theme Configuration - Single source of truth for all product themes
 * Defines all theme properties including colors, layouts, and rendering settings
 */

export interface ThemeStyles {
  layout: "classic" | "glass";
  bgColor: string;
  lightBgColor: string;
  fontColor: string;
  imageBgColor: string;
  priceBoxBg: string;
  gradientStart?: string;
  gradientEnd?: string;
  borderColor?: string;
  shadowColor?: string;
}

export interface ThemeRendering {
  cropAspectRatio: number;
  cardWidth: number;
  cardBorderRadius: number;
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  status: "Active" | "Inactive";
  styles: ThemeStyles;
  rendering: ThemeRendering;
}

export const THEMES: { [key: string]: ThemeConfig } = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "The default product card layout. Clean and minimalist design.",
    isDefault: true,
    status: "Active",
    styles: {
      layout: "classic",
      bgColor: "#dc2626",
      lightBgColor: "#fca5a5",
      fontColor: "white",
      imageBgColor: "white",
      priceBoxBg: "#dc2626",
      borderColor: "rgb(229, 231, 235)",
      shadowColor: "rgba(0, 0, 0, 0.1)",
    },
    rendering: {
      cropAspectRatio: 1,
      cardWidth: 330,
      cardBorderRadius: 8,
    },
  },

  glass: {
    id: "glass",
    name: "Glass",
    description: "Modern frosted glass design with transparency and blur effects.",
    isDefault: false,
    status: "Active",
    styles: {
      layout: "glass",
      bgColor: "#0f8577",
      lightBgColor: "#7fdcc7",
      fontColor: "white",
      imageBgColor: "white",
      priceBoxBg: "#dc2626",
      gradientStart: "#dc2626",
      gradientEnd: "#991b1b",
      borderColor: "rgba(255, 255, 255, 1)",
      shadowColor: "rgba(220, 38, 38, 0.3)",
    },
    rendering: {
      cropAspectRatio: 1,
      cardWidth: 360,
      cardBorderRadius: 16,
    },
  },

  // Future themes can be added here
  // premium: { ... }
  // minimal: { ... }
  // colorful: { ... }
};

/**
 * Get theme configuration by ID
 * Returns classic theme as fallback if theme ID not found
 */
export function getThemeById(themeId: string | null | undefined): ThemeConfig {
  if (!themeId || !THEMES[themeId]) {
    return THEMES.classic;
  }
  return THEMES[themeId];
}

/**
 * Get all available themes as array
 */
export function getAllThemes(): ThemeConfig[] {
  return Object.values(THEMES);
}

/**
 * Check if theme exists
 */
export function themeExists(themeId: string): boolean {
  return themeId in THEMES;
}
