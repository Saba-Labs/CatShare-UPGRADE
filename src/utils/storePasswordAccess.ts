const UNLOCK_PREFIX = 'catshare:store-unlock:';

function normalizedSlug(slug: string): string {
  return String(slug ?? '').trim().toLowerCase();
}

export function isStorePasswordUnlocked(storeSlug: string): boolean {
  const slug = normalizedSlug(storeSlug);
  if (!slug) return false;
  try {
    return sessionStorage.getItem(`${UNLOCK_PREFIX}${slug}`) === '1';
  } catch {
    return false;
  }
}

export function setStorePasswordUnlocked(storeSlug: string): void {
  const slug = normalizedSlug(storeSlug);
  if (!slug) return;
  try {
    sessionStorage.setItem(`${UNLOCK_PREFIX}${slug}`, '1');
  } catch {
    /* ignore */
  }
}

export function clearStorePasswordUnlock(storeSlug: string): void {
  const slug = normalizedSlug(storeSlug);
  if (!slug) return;
  try {
    sessionStorage.removeItem(`${UNLOCK_PREFIX}${slug}`);
  } catch {
    /* ignore */
  }
}
