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
  facebookPixelId: string;
  googleAnalyticsId: string;
}

export interface StoreMarketingPromotionSettings {
  announcementBarEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  promoBannerEnabled: boolean;
  promoBannerTitle: string;
  promoBannerMessage: string;
  promoBannerCta: string;
}

export interface StoreMarketingSharingSettings {
  whatsappShareEnabled: boolean;
  whatsappShareMessage: string;
}

export interface StoreMarketingCampaignSettings {
  discountCampaignsEnabled: boolean;
  emailMarketingEnabled: boolean;
}

export interface StoreMarketingSettings {
  version: 1;
  seo: StoreMarketingSeoSettings;
  tracking: StoreMarketingTrackingSettings;
  promotions: StoreMarketingPromotionSettings;
  sharing: StoreMarketingSharingSettings;
  campaigns: StoreMarketingCampaignSettings;
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
    facebookPixelId: '',
    googleAnalyticsId: '',
  },
  promotions: {
    announcementBarEnabled: false,
    announcementText: 'Free shipping on orders over ₹999',
    announcementLink: '',
    promoBannerEnabled: false,
    promoBannerTitle: 'Summer Sale',
    promoBannerMessage: 'Get 15% off your first order',
    promoBannerCta: 'Shop now',
  },
  sharing: {
    whatsappShareEnabled: true,
    whatsappShareMessage: 'Check out my store on CatShare!',
  },
  campaigns: {
    discountCampaignsEnabled: false,
    emailMarketingEnabled: false,
  },
};

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

function normalizeSection<T extends Record<string, unknown>>(
  raw: unknown,
  defaults: T
): T {
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
    sharing: normalizeSection(o.sharing, DEFAULT_MARKETING_SETTINGS.sharing),
    campaigns: normalizeSection(o.campaigns, DEFAULT_MARKETING_SETTINGS.campaigns),
  };
}
