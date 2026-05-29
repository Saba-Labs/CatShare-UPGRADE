import { DEFAULT_THEME } from '../config/homepageBuilderConfig';
import type { ThemeSettings, WebsiteModeConfig } from '../types/homepage';

/** Canonical site theme — always stored on the home page layout. */
export function getSiteTheme(websiteConfig: WebsiteModeConfig): ThemeSettings {
  return websiteConfig.pages.home.theme || DEFAULT_THEME;
}

/** Copy home theme to every custom page so the whole site shares one template look. */
export function syncSiteThemeAcrossPages(websiteConfig: WebsiteModeConfig): WebsiteModeConfig {
  const siteTheme = getSiteTheme(websiteConfig);
  const custom = websiteConfig.pages.custom || [];
  if (custom.length === 0) {
    return {
      ...websiteConfig,
      pages: {
        ...websiteConfig.pages,
        home: { ...websiteConfig.pages.home, theme: siteTheme },
      },
    };
  }

  return {
    ...websiteConfig,
    pages: {
      ...websiteConfig.pages,
      home: { ...websiteConfig.pages.home, theme: siteTheme },
      custom: custom.map((page) => ({
        ...page,
        layout: {
          ...page.layout,
          theme: { ...siteTheme },
        },
      })),
    },
  };
}
