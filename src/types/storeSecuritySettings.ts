/**
 * Store security settings — persisted on `stores.security_settings` JSONB.
 */

export interface StoreSecuritySettings {
  version: 1;
  passwordProtected: boolean;
  storePassword: string;
}

export const DEFAULT_SECURITY_SETTINGS: StoreSecuritySettings = {
  version: 1,
  passwordProtected: false,
  storePassword: '',
};

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function bool(raw: unknown, fallback = false): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (t === 'true' || t === '1') return true;
    if (t === 'false' || t === '0') return false;
  }
  return fallback;
}

export function isStorePasswordGateActive(raw: unknown): boolean {
  const settings = normalizeSecuritySettings(raw);
  return settings.passwordProtected && settings.storePassword.trim().length > 0;
}

export function normalizeSecuritySettings(raw: unknown): StoreSecuritySettings {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    version: 1,
    passwordProtected: bool(source.passwordProtected),
    storePassword: str(source.storePassword),
  };
}
