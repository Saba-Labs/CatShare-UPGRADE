import {
  EMPTY_BUSINESS_PROFILE,
  parseBusinessProfile,
  type BusinessProfile,
} from '../config/businessProfile';
import type { WebsiteModeConfig, WebsiteSiteSettings } from '../types/homepage';

export const BUSINESS_PROFILE_UPDATED_EVENT = 'business-profile-updated';

/** Brand, contact, and SEO copy the seller configured — never replaced by theme presets. */
const SELLER_PRESERVED_SITE_SETTING_KEYS = [
  'websiteName',
  'logoUrl',
  'headerTagline',
  'headerAbout',
  'footerDescription',
  'footerLocationText',
  'footerPhoneText',
  'footerEmailText',
] as const satisfies ReadonlyArray<keyof WebsiteSiteSettings>;

const SELLER_PRESERVED_SEO_KEYS = ['metaTitle', 'metaDescription', 'keywords'] as const;

function pickNonEmptyString(value?: string): string | undefined {
  const trimmed = value?.trim() || '';
  return trimmed || undefined;
}

/** Extract seller-owned site settings (only non-empty values). */
export function pickSellerPreservedSiteSettings(
  siteSettings: WebsiteSiteSettings
): Partial<WebsiteSiteSettings> {
  const out: Partial<WebsiteSiteSettings> = {};
  for (const key of SELLER_PRESERVED_SITE_SETTING_KEYS) {
    const value = pickNonEmptyString(siteSettings[key] as string | undefined);
    if (value !== undefined) {
      (out as Record<string, string>)[key] = value;
    }
  }
  if (siteSettings.footerColumns?.length) {
    out.footerColumns = siteSettings.footerColumns;
  }
  return out;
}

/** Theme layout/colors apply, but brand name, tagline, and contact stay with the seller. */
export function mergeThemeSiteSettingsWithSeller(
  themeSettings: WebsiteSiteSettings,
  sellerSettings: WebsiteSiteSettings,
  profile: BusinessProfile = readCachedBusinessProfile()
): WebsiteSiteSettings {
  const hydratedSeller = hydrateSiteSettingsFromBusinessProfile(sellerSettings, profile);
  const preserved = pickSellerPreservedSiteSettings(hydratedSeller);
  return {
    ...themeSettings,
    ...preserved,
  };
}

export function mergeThemeSeoWithSeller(
  themeSeo: WebsiteModeConfig['seo'] | undefined,
  sellerSeo: WebsiteModeConfig['seo'] | undefined
): WebsiteModeConfig['seo'] | undefined {
  if (!sellerSeo) return themeSeo;
  const base = { ...themeSeo };
  for (const key of SELLER_PRESERVED_SEO_KEYS) {
    const value = pickNonEmptyString(sellerSeo[key]);
    if (value !== undefined) {
      base[key] = value;
    }
  }
  if (sellerSeo.allowIndexing !== undefined) {
    base.allowIndexing = sellerSeo.allowIndexing;
  }
  return base;
}

export function readCachedBusinessProfile(): BusinessProfile {
  try {
    const raw = localStorage.getItem('businessProfile');
    if (raw) return parseBusinessProfile(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return { ...EMPTY_BUSINESS_PROFILE };
}

export function writeCachedBusinessProfile(profile: BusinessProfile): void {
  try {
    localStorage.setItem('businessProfile', JSON.stringify(profile));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(BUSINESS_PROFILE_UPDATED_EVENT, { detail: profile }));
}

export function patchCachedBusinessProfile(patch: Partial<BusinessProfile>): BusinessProfile {
  const next = { ...readCachedBusinessProfile(), ...patch };
  writeCachedBusinessProfile(next);
  return next;
}

/** Map homepage site settings brand/contact fields → business profile. */
export function businessProfilePatchFromSiteSettings(
  patch: Partial<WebsiteSiteSettings>
): Partial<BusinessProfile> {
  const out: Partial<BusinessProfile> = {};
  if (patch.websiteName !== undefined) out.businessName = patch.websiteName;
  if (patch.logoUrl !== undefined) out.logoUrl = patch.logoUrl;
  if (patch.headerTagline !== undefined) out.about = patch.headerTagline;
  if (patch.headerAbout !== undefined) out.description = patch.headerAbout;
  if (patch.footerDescription !== undefined) out.about = patch.footerDescription;
  if (patch.footerLocationText !== undefined) out.address = patch.footerLocationText;
  if (patch.footerPhoneText !== undefined) out.phone = patch.footerPhoneText;
  if (patch.footerEmailText !== undefined) out.email = patch.footerEmailText;
  return out;
}

/** Map business profile → homepage site settings brand/contact fields. */
export function siteSettingsPatchFromBusinessProfile(
  profile: BusinessProfile
): Partial<WebsiteSiteSettings> {
  const pick = (value?: string) => {
    const trimmed = value?.trim() || '';
    return trimmed || undefined;
  };
  return {
    websiteName: pick(profile.businessName),
    logoUrl: pick(profile.logoUrl),
    headerTagline: pick(profile.about),
    headerAbout: pick(profile.description),
    footerDescription: pick(profile.about),
    footerLocationText: pick(profile.address),
    footerPhoneText: pick(profile.phone),
    footerEmailText: pick(profile.email),
  };
}

/** Fill site settings from business profile — profile wins when it has content. */
export function hydrateSiteSettingsFromBusinessProfile(
  siteSettings: WebsiteSiteSettings,
  profile: BusinessProfile = readCachedBusinessProfile()
): WebsiteSiteSettings {
  const pick = (siteVal: string | undefined, bpVal: string) => {
    const fromProfile = bpVal?.trim() || '';
    if (fromProfile) return fromProfile;
    return siteVal?.trim() || siteVal;
  };
  return {
    ...siteSettings,
    websiteName: pick(siteSettings.websiteName, profile.businessName),
    logoUrl: pick(siteSettings.logoUrl, profile.logoUrl),
    headerTagline: pick(siteSettings.headerTagline, profile.about),
    headerAbout: pick(siteSettings.headerAbout, profile.description),
    footerDescription: pick(siteSettings.footerDescription, profile.about),
    footerLocationText: pick(siteSettings.footerLocationText, profile.address),
    footerPhoneText: pick(siteSettings.footerPhoneText, profile.phone),
    footerEmailText: pick(siteSettings.footerEmailText, profile.email),
  };
}

export function syncSiteSettingsPatchToBusinessProfile(patch: Partial<WebsiteSiteSettings>): void {
  const bpPatch = businessProfilePatchFromSiteSettings(patch);
  if (Object.keys(bpPatch).length > 0) {
    patchCachedBusinessProfile(bpPatch);
  }
}

export function businessProfileToPreviewStoreFields(profile: BusinessProfile) {
  return {
    sellerLogoUrl: profile.logoUrl || undefined,
    sellerBusinessName: profile.businessName || undefined,
    sellerAbout: profile.about || undefined,
    sellerDescription: profile.description || undefined,
    sellerEmail: profile.email || undefined,
    sellerPhone: profile.phone || undefined,
    sellerWebsite: profile.website || undefined,
    sellerAddress: profile.address || undefined,
    instagram: profile.instagram || undefined,
    twitter: profile.twitter || undefined,
    facebook: profile.facebook || undefined,
  };
}
