/**
 * Offline / no-Supabase persistence for the homepage editor.
 * Stores everything in localStorage so the builder works without a backend.
 * Mirrors the homepageService API; swap back to Supabase by flipping
 * USE_LOCAL_HOMEPAGE_STORE in homepageService.ts.
 */
import { v4 as uuid } from 'uuid';
import { HomepageConfig, HomepageLayout } from '../types/homepage';

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
  const raw = readJson<HomepageConfig & { publishHistory?: unknown }>(`${CONFIG_PREFIX}${configId}`);
  if (!raw) return null;
  const { publishHistory: _removed, ...config } = raw;
  return config;
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
  _options?: { updatedBy?: string }
): HomepageConfig {
  const existing = readConfig(configId);
  const nextLayout = layout || existing?.layout || ({ sections: [], theme: {} } as HomepageLayout);
  const publishedAt = new Date().toISOString();

  return patchConfig(configId, {
    layout: nextLayout,
    publishedLayout: nextLayout,
    publishedAt,
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

