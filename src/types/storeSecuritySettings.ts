/**
 * Store security settings — persisted on `stores.security_settings` JSONB.
 */

export type StoreVisibility = 'public' | 'unlisted' | 'private';

export interface StoreSecuritySettings {
  version: 1;
  visibility: StoreVisibility;
  passwordProtected: boolean;
  storePassword: string;
  blockedCustomers: string[];
  allowedCountries: string[];
  twoFactorEnabled: boolean;
}

export const DEFAULT_SECURITY_SETTINGS: StoreSecuritySettings = {
  version: 1,
  visibility: 'public',
  passwordProtected: false,
  storePassword: '',
  blockedCustomers: [],
  allowedCountries: [],
  twoFactorEnabled: false,
};

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function bool(raw: unknown, fallback = false): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

function strArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

function visibility(raw: unknown): StoreVisibility {
  if (raw === 'public' || raw === 'unlisted' || raw === 'private') return raw;
  return 'public';
}

export function normalizeSecuritySettings(raw: unknown): StoreSecuritySettings {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    version: 1,
    visibility: visibility(source.visibility),
    passwordProtected: bool(source.passwordProtected),
    storePassword: str(source.storePassword),
    blockedCustomers: strArray(source.blockedCustomers),
    allowedCountries: strArray(source.allowedCountries),
    twoFactorEnabled: bool(source.twoFactorEnabled),
  };
}
