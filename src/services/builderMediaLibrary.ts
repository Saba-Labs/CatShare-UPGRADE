export interface BuilderMediaItem {
  id: string;
  url: string;
  name?: string;
  addedAt: string;
}

const STORAGE_PREFIX = 'catshare-builder-media';
const MAX_ITEMS = 48;

function storageKey(storeId: string): string {
  return `${STORAGE_PREFIX}:${storeId}`;
}

export function loadBuilderMediaLibrary(storeId: string): BuilderMediaItem[] {
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BuilderMediaItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBuilderMediaLibrary(storeId: string, items: BuilderMediaItem[]): void {
  try {
    localStorage.setItem(storageKey(storeId), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota or private mode */
  }
}

export function addToBuilderMediaLibrary(
  storeId: string,
  url: string,
  name?: string
): BuilderMediaItem[] {
  const existing = loadBuilderMediaLibrary(storeId);
  const withoutDup = existing.filter((item) => item.url !== url);
  const entry: BuilderMediaItem = {
    id: `media-${Date.now()}`,
    url,
    name,
    addedAt: new Date().toISOString(),
  };
  const next = [entry, ...withoutDup].slice(0, MAX_ITEMS);
  saveBuilderMediaLibrary(storeId, next);
  return next;
}

export function removeFromBuilderMediaLibrary(storeId: string, id: string): BuilderMediaItem[] {
  const next = loadBuilderMediaLibrary(storeId).filter((item) => item.id !== id);
  saveBuilderMediaLibrary(storeId, next);
  return next;
}
