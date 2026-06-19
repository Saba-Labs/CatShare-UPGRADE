/**
 * Store marketing settings — persisted on `stores.marketing_settings` JSONB.
 */

export interface StoreMarketingSeoSettings {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogImageUrl: string;
}

export interface StoreMarketingTrackingSettings {
  googleSearchConsoleVerification: string;
}

export interface StoreMarketingPromotionSettings {
  announcementBarEnabled: boolean;
  announcementText: string;
  announcementLink: string;
}

export interface StoreMarketingSettings {
  version: 1;
  seo: StoreMarketingSeoSettings;
  tracking: StoreMarketingTrackingSettings;
  promotions: StoreMarketingPromotionSettings;
}

export const DEFAULT_MARKETING_SETTINGS: StoreMarketingSettings = {
  version: 1,
  seo: {
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    ogImageUrl: '',
  },
  tracking: {
    googleSearchConsoleVerification: '',
  },
  promotions: {
    announcementBarEnabled: false,
    announcementText: 'Free shipping on orders over ₹999',
    announcementLink: '',
  },
};

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function bool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (t === 'true' || t === '1') return true;
    if (t === 'false' || t === '0') return false;
  }
  return fallback;
}

function normalizeSection<T extends object>(raw: unknown, defaults: T): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...defaults };
  }
  const result = { ...defaults };
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    const val = r[key];
    if (typeof def === 'boolean') {
      (result as Record<string, unknown>)[key] = bool(val, def);
    } else if (typeof def === 'string') {
      (result as Record<string, unknown>)[key] = str(val, def);
    }
  }
  return result;
}

/** Accept meta tag content, `google-site-verification=…`, or a bare token. */
export function parseGoogleSiteVerificationToken(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const contentMatch = t.match(/content=["']([^"']+)["']/i);
  if (contentMatch) return contentMatch[1].trim();
  const eqMatch = t.match(/google-site-verification[=:]\s*([^\s"'>]+)/i);
  if (eqMatch) return eqMatch[1].trim();
  return t;
}

export function normalizeMarketingSettings(raw: unknown): StoreMarketingSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_MARKETING_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    version: 1,
    seo: normalizeSection(o.seo, DEFAULT_MARKETING_SETTINGS.seo),
    tracking: normalizeSection(o.tracking, DEFAULT_MARKETING_SETTINGS.tracking),
    promotions: normalizeSection(o.promotions, DEFAULT_MARKETING_SETTINGS.promotions),
  };
}
