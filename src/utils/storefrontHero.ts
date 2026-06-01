import { parseBusinessProfile } from '../config/businessProfile';
import type { StorePublic } from '../services/storeService';
import type { WebsiteSiteSettings } from '../types/homepage';

export function resolveStoreHeroCopy(
  store: StorePublic | null | undefined,
  siteSettings: WebsiteSiteSettings
): { primary: string | null; secondary: string | null } {
  const fromSettings = siteSettings.headerTagline?.trim() || siteSettings.footerDescription?.trim() || '';
  const aboutFromSettings = siteSettings.headerAbout?.trim() || '';

  if (fromSettings || aboutFromSettings) {
    return {
      primary: fromSettings || null,
      secondary: aboutFromSettings && aboutFromSettings !== fromSettings ? aboutFromSettings : null,
    };
  }

  if (!store) {
    try {
      const bp = parseBusinessProfile(JSON.parse(localStorage.getItem('businessProfile') || 'null'));
      const a = bp.about?.trim() || bp.description?.trim() || '';
      if (a) return { primary: a, secondary: null };
    } catch {
      /* ignore */
    }
    return { primary: null, secondary: null };
  }

  const a = store.sellerAbout?.trim() || '';
  const t = store.tagline?.trim() || '';
  const d = store.sellerDescription?.trim() || '';
  if (a) return { primary: a, secondary: d && d !== a ? d : null };
  if (t) return { primary: t, secondary: d && d !== t ? d : null };
  if (d) return { primary: d, secondary: null };
  return { primary: null, secondary: null };
}
