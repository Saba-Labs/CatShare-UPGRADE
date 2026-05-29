import { HomepageConfig, HomepageLayout, PublishHistoryEntry } from '../types/homepage';
import { isPersistedHomepageConfigId } from '../utils/homepageConfigId';
import { withRetry } from '../utils/retry';
import { getSupabaseClient } from '../supabaseClient';
import {
  localAutoSaveHomepage,
  localCreateHomepageConfig,
  localDeleteHomepageConfig,
  localGetHomepageConfig,
  localPublishHomepageConfig,
  localRestoreHomepageVersion,
  localUnpublishHomepageConfig,
  localUpdateHomepageLayout,
} from './homepageLocalStore';

/**
 * TEMPORARY: run the homepage editor fully offline (localStorage), with no Supabase calls.
 * Flip to `false` (or wire to an env flag) to reconnect the backend once it's ready.
 */
export const USE_LOCAL_HOMEPAGE_STORE = true;

const TABLE = 'store_homepage_configs';

function mapHomepageConfigRow(data: Record<string, unknown>): HomepageConfig {
  return {
    id: data.id as string,
    storeId: data.store_id as string,
    layout: data.layout as HomepageLayout,
    publishedLayout: (data.published_layout as HomepageLayout) || undefined,
    publishedAt: (data.published_at as string) || null,
    publishHistory: (data.publish_history as PublishHistoryEntry[]) || [],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    autoSavedAt: data.auto_saved_at as string | undefined,
  };
}

export async function getHomepageConfig(storeId: string): Promise<HomepageConfig | null> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localGetHomepageConfig(storeId);
  }
  return withRetry(async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch homepage config: ${error.message}`);
    }
    if (!data) return null;
    return mapHomepageConfigRow(data as Record<string, unknown>);
  });
}

/** Resolve a real config row: use existing id, fetch by store, or create. */
export async function ensureHomepageConfig(
  storeId: string,
  current: HomepageConfig | null | undefined,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  if (current && isPersistedHomepageConfigId(current.id)) {
    return current;
  }

  const existing = await getHomepageConfig(storeId);
  if (existing) return existing;

  try {
    return await createHomepageConfig(storeId, layout);
  } catch (err) {
    const retry = await getHomepageConfig(storeId);
    if (retry) return retry;
    throw err;
  }
}

export async function createHomepageConfig(
  storeId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localCreateHomepageConfig(storeId, layout);
  }
  return withRetry(async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(TABLE)
      .insert({
        store_id: storeId,
        layout,
        theme_settings: layout.theme,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create homepage config: ${error.message}`);
    }
    return mapHomepageConfigRow(data as Record<string, unknown>);
  });
}

export async function updateHomepageLayout(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localUpdateHomepageLayout(configId, layout);
  }
  return withRetry(async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(TABLE)
      .update({
        layout,
        theme_settings: layout.theme,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update homepage config: ${error.message}`);
    }
    return mapHomepageConfigRow(data as Record<string, unknown>);
  });
}

export async function autoSaveHomepage(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localAutoSaveHomepage(configId, layout);
  }
  return withRetry(async () => {
    const client = getSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from(TABLE)
      .update({
        layout,
        theme_settings: layout.theme,
        updated_at: now,
        auto_saved_at: now,
      })
      .eq('id', configId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to auto-save homepage: ${error.message}`);
    }
    return mapHomepageConfigRow(data as Record<string, unknown>);
  });
}

export async function deleteHomepageConfig(configId: string): Promise<void> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    localDeleteHomepageConfig(configId);
    return;
  }
  const client = getSupabaseClient();
  const { error } = await client.from(TABLE).delete().eq('id', configId);
  if (error) {
    throw new Error(error.message || 'Failed to delete config');
  }
}

export async function duplicateHomepageConfig(
  configId: string,
  newStoreId: string
): Promise<HomepageConfig> {
  const existing = await getHomepageConfig(configId);
  if (!existing) throw new Error('Homepage config not found');
  return createHomepageConfig(newStoreId, existing.layout);
}

export async function publishHomepageConfig(
  configId: string,
  layout: HomepageLayout,
  options?: { updatedBy?: string; note?: string }
): Promise<HomepageConfig> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localPublishHomepageConfig(configId, layout, options);
  }
  const client = getSupabaseClient();

  const { data: existing, error: fetchError } = await client
    .from(TABLE)
    .select('layout, publish_history')
    .eq('id', configId)
    .single();
  if (fetchError) throw new Error(fetchError.message || 'Failed to publish homepage config');

  const nextLayout: HomepageLayout & { websiteConfig?: any } =
    layout || (existing?.layout as HomepageLayout) || ({} as HomepageLayout);
  if (nextLayout && typeof nextLayout === 'object') {
    (nextLayout as any).websiteConfig = (nextLayout as any).websiteConfig || {};
    (nextLayout as any).websiteConfig.versioning = {
      ...((nextLayout as any).websiteConfig.versioning || {}),
      publishedAt: new Date().toISOString(),
      updatedBy: options?.updatedBy ?? null,
    };
  }

  const publishedAt = new Date().toISOString();
  const historyEntry = {
    id: `pub-${Date.now()}`,
    publishedAt,
    layout: nextLayout,
    note: options?.note,
  };
  const priorHistory = Array.isArray(existing?.publish_history) ? existing.publish_history : [];
  const publishHistory = [historyEntry, ...priorHistory].slice(0, 20);

  const { data, error } = await client
    .from(TABLE)
    .update({
      layout: nextLayout,
      theme_settings: nextLayout?.theme,
      published_layout: nextLayout,
      published_at: publishedAt,
      publish_history: publishHistory,
      updated_at: publishedAt,
    })
    .eq('id', configId)
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to publish homepage config');
  return mapHomepageConfigRow(data as Record<string, unknown>);
}

export async function unpublishHomepageConfig(configId: string): Promise<HomepageConfig> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localUnpublishHomepageConfig(configId);
  }
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABLE)
    .update({
      published_layout: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', configId)
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to unpublish homepage config');
  return mapHomepageConfigRow(data as Record<string, unknown>);
}

export async function restoreHomepageVersion(
  configId: string,
  versionId: string,
  target: 'draft' | 'live' = 'draft'
): Promise<HomepageConfig> {
  if (!versionId) throw new Error('versionId is required');
  if (USE_LOCAL_HOMEPAGE_STORE) {
    return localRestoreHomepageVersion(configId, versionId, target);
  }
  const client = getSupabaseClient();

  const { data: existing, error: fetchError } = await client
    .from(TABLE)
    .select('publish_history')
    .eq('id', configId)
    .single();
  if (fetchError) throw new Error(fetchError.message || 'Failed to restore version');

  const history = Array.isArray(existing?.publish_history) ? existing.publish_history : [];
  const entry = history.find((h: { id?: string }) => h?.id === versionId) as
    | { layout?: HomepageLayout; publishedAt?: string }
    | undefined;
  if (!entry?.layout) throw new Error('Version not found');

  const now = new Date().toISOString();
  const restoreTarget = target === 'live' ? 'live' : 'draft';
  const patch =
    restoreTarget === 'live'
      ? {
          layout: entry.layout,
          published_layout: entry.layout,
          published_at: entry.publishedAt || now,
          theme_settings: entry.layout?.theme,
          updated_at: now,
        }
      : {
          layout: entry.layout,
          theme_settings: entry.layout?.theme,
          updated_at: now,
        };

  const { data, error } = await client
    .from(TABLE)
    .update(patch)
    .eq('id', configId)
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to restore version');
  return mapHomepageConfigRow(data as Record<string, unknown>);
}
