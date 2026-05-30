import { collectLayoutImageUrls } from '../utils/collectLayoutImageUrls';
import type { HomepageLayout } from '../types/homepage';

export interface BuilderMediaItem {
  id: string;
  url: string;
  name?: string;
  addedAt: string;
}

const STORAGE_PREFIX = 'catshare-builder-media';
const MAX_ITEMS = 120;

function storageKey(storeId: string): string {
  return `${STORAGE_PREFIX}:${storeId}`;
}

function urlId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return `media-${Math.abs(hash).toString(36)}`;
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
    id: urlId(url),
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

/** Add layout URLs into local storage without removing manual uploads. */
export function ensureUrlsInBuilderMediaLibrary(
  storeId: string,
  urls: string[]
): BuilderMediaItem[] {
  const existing = loadBuilderMediaLibrary(storeId);
  const byUrl = new Map(existing.map((item) => [item.url, item]));
  let changed = false;

  for (const url of urls) {
    if (!byUrl.has(url)) {
      byUrl.set(url, {
        id: urlId(url),
        url,
        name: 'On site',
        addedAt: new Date().toISOString(),
      });
      changed = true;
    }
  }

  if (!changed) return existing;

  const layoutUrls = new Set(urls);
  const fromLayout = urls
    .map((u) => byUrl.get(u)!)
    .filter(Boolean);
  const rest = existing.filter((item) => !layoutUrls.has(item.url));
  const next = [...fromLayout, ...rest].slice(0, MAX_ITEMS);
  saveBuilderMediaLibrary(storeId, next);
  return next;
}

export function syncBuilderMediaLibraryFromLayout(
  storeId: string,
  layout: HomepageLayout | null | undefined
): BuilderMediaItem[] {
  return ensureUrlsInBuilderMediaLibrary(storeId, collectLayoutImageUrls(layout));
}

/** Stored library + any layout URLs not yet persisted (read-only merge for display). */
export function getMergedBuilderMediaLibrary(
  storeId: string,
  layout: HomepageLayout | null | undefined
): BuilderMediaItem[] {
  const stored = loadBuilderMediaLibrary(storeId);
  const layoutUrls = collectLayoutImageUrls(layout);
  const byUrl = new Map(stored.map((item) => [item.url, item]));

  for (const url of layoutUrls) {
    if (!byUrl.has(url)) {
      byUrl.set(url, {
        id: urlId(url),
        url,
        name: 'On site',
        addedAt: '',
      });
    }
  }

  const storedUrls = new Set(stored.map((s) => s.url));
  const layoutOnly = layoutUrls.filter((u) => !storedUrls.has(u));
  return [...stored, ...layoutOnly.map((url) => byUrl.get(url)!)].slice(0, MAX_ITEMS);
}
