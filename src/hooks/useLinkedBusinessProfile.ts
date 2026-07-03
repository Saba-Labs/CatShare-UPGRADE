import { useEffect, useState } from 'react';
import type { BusinessProfile } from '../config/businessProfile';
import type { WebsiteSiteSettings } from '../types/homepage';
import {
  BUSINESS_PROFILE_UPDATED_EVENT,
  readCachedBusinessProfile,
} from '../utils/businessProfileStorefront';

/** Live business profile cache — updates when builder or Business Profile page edits. */
export function useLinkedBusinessProfile(): BusinessProfile {
  const [profile, setProfile] = useState<BusinessProfile>(() => readCachedBusinessProfile());

  useEffect(() => {
    const onUpdated = (event: Event) => {
      setProfile((event as CustomEvent<BusinessProfile>).detail ?? readCachedBusinessProfile());
    };
    window.addEventListener(BUSINESS_PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(BUSINESS_PROFILE_UPDATED_EVENT, onUpdated);
  }, []);

  return profile;
}

/** Merged values shown in builder inputs (site settings + business profile). */
export function getLinkedBrandDisplay(
  siteSettings: WebsiteSiteSettings,
  profile: BusinessProfile
) {
  const pick = (siteVal?: string, bpVal?: string) => siteVal?.trim() || bpVal?.trim() || '';
  return {
    websiteName: pick(siteSettings.websiteName, profile.businessName),
    logoUrl: pick(siteSettings.logoUrl, profile.logoUrl),
    headerTagline: pick(siteSettings.headerTagline, profile.about),
    headerAbout: pick(siteSettings.headerAbout, profile.description),
    footerDescription: pick(siteSettings.footerDescription, profile.about),
    footerLocationText: pick(siteSettings.footerLocationText, profile.address),
    footerPhoneText: pick(siteSettings.footerPhoneText, profile.phone),
    footerEmailText: pick(siteSettings.footerEmailText, profile.email),
    website: profile.website?.trim() || '',
    instagram: profile.instagram?.trim() || '',
    facebook: profile.facebook?.trim() || '',
    twitter: profile.twitter?.trim() || '',
  };
}

/** Keep tagline in sync across header hero + footer head. */
export function withLinkedTaglinePatch(
  patch: Partial<WebsiteSiteSettings>
): Partial<WebsiteSiteSettings> {
  const next = { ...patch };
  if (patch.headerTagline !== undefined) {
    next.footerDescription = patch.headerTagline;
  }
  if (patch.footerDescription !== undefined) {
    next.headerTagline = patch.footerDescription;
  }
  return next;
}
