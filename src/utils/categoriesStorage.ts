import { getStorageKey } from './safeStorage';

/** Read product category labels: prefer per-user key when logged in. */
export function readCategoriesList(userId: string | null): string[] {
  try {
    const keyed = userId ? localStorage.getItem(getStorageKey('categories', userId)) : null;
    const raw = keyed ?? localStorage.getItem('categories') ?? '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((c: unknown) => typeof c === 'string' && String(c).trim())
      : [];
  } catch {
    return [];
  }
}

/** Persist category list to legacy + keyed storage (matches SyncContext / SideDrawer). */
export function persistCategoriesList(userId: string | null, list: string[]): void {
  const json = JSON.stringify(list);
  localStorage.setItem('categories', json);
  if (userId) {
    localStorage.setItem(getStorageKey('categories', userId), json);
  }
}
