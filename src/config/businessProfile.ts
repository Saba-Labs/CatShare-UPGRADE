/**
 * Business / seller profile stored in user_settings.data.businessProfile (JSON).
 * Separate from login email — used for PDFs, link share, etc.
 */
export type BusinessProfile = {
  /** Public URL of logo (e.g. R2 after upload). */
  logoUrl: string;
  businessName: string;
  address: string;
  /** Business contact email (may differ from login email). */
  email: string;
  phone: string;
  website: string;
  instagram: string;
  facebook: string;
  twitter: string;
  /** Short intro / tagline. */
  about: string;
  /** Longer description. */
  description: string;
};

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  logoUrl: '',
  businessName: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  instagram: '',
  facebook: '',
  twitter: '',
  about: '',
  description: '',
};

export function parseBusinessProfile(raw: unknown): BusinessProfile {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_BUSINESS_PROFILE };
  const o = raw as Record<string, unknown>;
  return {
    logoUrl: typeof o.logoUrl === 'string' ? o.logoUrl : '',
    businessName: typeof o.businessName === 'string' ? o.businessName : '',
    address: typeof o.address === 'string' ? o.address : '',
    email: typeof o.email === 'string' ? o.email : '',
    phone: typeof o.phone === 'string' ? o.phone : '',
    website: typeof o.website === 'string' ? o.website : '',
    instagram: typeof o.instagram === 'string' ? o.instagram : '',
    facebook: typeof o.facebook === 'string' ? o.facebook : '',
    twitter: typeof o.twitter === 'string' ? o.twitter : '',
    about: typeof o.about === 'string' ? o.about : '',
    description: typeof o.description === 'string' ? o.description : '',
  };
}

export function businessProfileFromUserSettings(userSettings: any | null | undefined): BusinessProfile {
  return parseBusinessProfile(userSettings?.data?.businessProfile);
}

function businessProfileHasVisibleDetail(bp: BusinessProfile): boolean {
  return [
    bp.businessName,
    bp.address,
    bp.email,
    bp.phone,
    bp.website,
    bp.instagram,
    bp.facebook,
    bp.twitter,
    bp.about,
    bp.description,
  ].some(
    (s) => typeof s === 'string' && s.trim().length > 0
  );
}

/** Prefer Supabase user_settings; fall back to local cache from Account / sync. */
export function getBusinessProfileForPdf(userSettings: any | null | undefined): BusinessProfile {
  const fromSettings = businessProfileFromUserSettings(userSettings);
  if (businessProfileHasVisibleDetail(fromSettings)) return fromSettings;
  try {
    const raw = localStorage.getItem('businessProfile');
    if (raw) {
      const parsed = parseBusinessProfile(JSON.parse(raw));
      if (businessProfileHasVisibleDetail(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return fromSettings;
}
