import { getStorefrontRootHost } from './storefrontDomain';

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function normalizeStoreHostnameInput(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0] ?? '';
  s = s.split(':')[0] ?? '';
  s = s.replace(/\.+$/, '');
  if (s.startsWith('www.')) s = s.slice(4);
  return s;
}

export function validateStoreHostnameInput(raw: string): { ok: true; hostname: string } | { ok: false; error: string } {
  const hostname = normalizeStoreHostnameInput(raw);
  const root = getStorefrontRootHost();
  if (!hostname) return { ok: false, error: 'Enter your domain (e.g. shop.yourbrand.com).' };
  if (!hostname.includes('.')) {
    return { ok: false, error: 'Use a full domain such as shop.yourbrand.com.' };
  }
  if (!HOSTNAME_RE.test(hostname)) {
    return { ok: false, error: 'Use only letters, numbers, hyphens, and dots.' };
  }
  if (hostname === root || hostname.endsWith(`.${root}`)) {
    return { ok: false, error: `Use your CatShare subdomain for *.${root}. Enter your own domain here.` };
  }
  return { ok: true, hostname };
}
