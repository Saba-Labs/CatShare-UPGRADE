/**
 * Normalize and validate a seller custom storefront hostname (server + shared rules).
 */

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

const BLOCKED_SUFFIXES = [
  '.vercel.app',
  '.netlify.app',
  '.pages.dev',
  '.cloudflarepages.net',
  '.github.io',
];

export type HostnameValidationResult =
  | { ok: true; hostname: string }
  | { ok: false; error: string };

export function normalizeStoreHostnameInput(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0] ?? '';
  s = s.split(':')[0] ?? '';
  s = s.replace(/\.+$/, '');
  if (s.startsWith('www.')) s = s.slice(4);
  return s;
}

export function validateStoreHostname(
  raw: string,
  options?: { platformRootHost?: string }
): HostnameValidationResult {
  const hostname = normalizeStoreHostnameInput(raw);
  if (!hostname) return { ok: false, error: 'Enter your domain (e.g. shop.yourbrand.com).' };
  if (hostname.length > 253) return { ok: false, error: 'Domain name is too long.' };
  if (!hostname.includes('.')) {
    return { ok: false, error: 'Use a full domain such as shop.yourbrand.com (not a single word).' };
  }
  if (!HOSTNAME_RE.test(hostname)) {
    return {
      ok: false,
      error: 'Use only letters, numbers, hyphens, and dots (e.g. shop.yourbrand.com).',
    };
  }

  const root = (options?.platformRootHost || 'catshare.app').trim().toLowerCase();
  if (hostname === root || hostname.endsWith(`.${root}`)) {
    return {
      ok: false,
      error: `Use your CatShare link (${root}) for the default store URL. Custom domain must be your own domain.`,
    };
  }

  for (const suffix of BLOCKED_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return { ok: false, error: 'Hosting preview domains cannot be used as a store domain.' };
    }
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, error: 'localhost cannot be used as a custom store domain.' };
  }

  return { ok: true, hostname };
}
