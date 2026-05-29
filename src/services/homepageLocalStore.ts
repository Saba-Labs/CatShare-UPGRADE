/**
 * Offline / no-Supabase persistence for the homepage editor.
 * Stores everything in localStorage so the builder works without a backend.
 * Mirrors the homepageService API; swap back to Supabase by flipping
 * USE_LOCAL_HOMEPAGE_STORE in homepageService.ts.
 */
import { v4 as uuid } from 'uuid';
import { HomepageConfig, HomepageLayout, PublishHistoryEntry } from '../types/homepage';

const POINTER_PREFIX = 'homepage_cfg_id::';
const CONFIG_PREFIX = 'homepage_cfg::';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

function readConfig(configId: string): HomepageConfig | null {
  return readJson<HomepageConfig>(`${CONFIG_PREFIX}${configId}`);
}

function writeConfig(config: HomepageConfig): HomepageConfig {
  writeJson(`${CONFIG_PREFIX}${config.id}`, config);
  writeJson(`${POINTER_PREFIX}${config.storeId}`, config.id);
  return config;
}

export function localGetHomepageConfig(storeId: string): HomepageConfig | null {
  const configId = readJson<string>(`${POINTER_PREFIX}${storeId}`);
  if (!configId) return null;
  return readConfig(configId);
}

export function localCreateHomepageConfig(storeId: string, layout: HomepageLayout): HomepageConfig {
  const now = new Date().toISOString();
  const config: HomepageConfig = {
    id: uuid(),
    storeId,
    layout,
    publishedLayout: undefined,
    publishedAt: null,
    publishHistory: [],
    createdAt: now,
    updatedAt: now,
    autoSavedAt: undefined,
  };
  return writeConfig(config);
}

function patchConfig(configId: string, patch: Partial<HomepageConfig>): HomepageConfig {
  const existing = readConfig(configId);
  if (!existing) {
    throw new Error('Homepage config not found in local store');
  }
  return writeConfig({ ...existing, ...patch });
}

export function localUpdateHomepageLayout(configId: string, layout: HomepageLayout): HomepageConfig {
  return patchConfig(configId, { layout, updatedAt: new Date().toISOString() });
}

export function localAutoSaveHomepage(configId: string, layout: HomepageLayout): HomepageConfig {
  const now = new Date().toISOString();
  return patchConfig(configId, { layout, updatedAt: now, autoSavedAt: now });
}

export function localDeleteHomepageConfig(configId: string): void {
  const existing = readConfig(configId);
  try {
    localStorage.removeItem(`${CONFIG_PREFIX}${configId}`);
    if (existing) localStorage.removeItem(`${POINTER_PREFIX}${existing.storeId}`);
  } catch {
    /* ignore */
  }
}

export function localPublishHomepageConfig(
  configId: string,
  layout: HomepageLayout,
  options?: { updatedBy?: string; note?: string }
): HomepageConfig {
  const existing = readConfig(configId);
  const nextLayout = layout || existing?.layout || ({ sections: [], theme: {} } as HomepageLayout);
  const publishedAt = new Date().toISOString();
  const entry: PublishHistoryEntry = {
    id: `pub-${Date.now()}`,
    publishedAt,
    layout: nextLayout,
    note: options?.note,
  } as PublishHistoryEntry;
  const priorHistory = Array.isArray(existing?.publishHistory) ? existing!.publishHistory : [];
  const publishHistory = [entry, ...priorHistory].slice(0, 20);

  return patchConfig(configId, {
    layout: nextLayout,
    publishedLayout: nextLayout,
    publishedAt,
    publishHistory,
    updatedAt: publishedAt,
  });
}

export function localUnpublishHomepageConfig(configId: string): HomepageConfig {
  return patchConfig(configId, {
    publishedLayout: undefined,
    publishedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

export function localRestoreHomepageVersion(
  configId: string,
  versionId: string,
  target: 'draft' | 'live' = 'draft'
): HomepageConfig {
  const existing = readConfig(configId);
  const history = Array.isArray(existing?.publishHistory) ? existing!.publishHistory : [];
  const entry = history.find((h) => h?.id === versionId);
  if (!entry?.layout) throw new Error('Version not found');

  const now = new Date().toISOString();
  if (target === 'live') {
    return patchConfig(configId, {
      layout: entry.layout,
      publishedLayout: entry.layout,
      publishedAt: entry.publishedAt || now,
      updatedAt: now,
    });
  }
  return patchConfig(configId, { layout: entry.layout, updatedAt: now });
}
