import { HomepageConfig, HomepageLayout, PublishHistoryEntry } from '../types/homepage';
import { isPersistedHomepageConfigId, isPersistedStoreId } from '../utils/homepageConfigId';
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
 * When true, the editor keeps drafts in localStorage (see VITE_USE_LOCAL_HOMEPAGE_STORE).
 * Public storefronts always read published layout from Supabase regardless of this flag.
 */
export const USE_LOCAL_HOMEPAGE_STORE =
  String(import.meta.env.VITE_USE_LOCAL_HOMEPAGE_STORE || '').toLowerCase() === 'true';

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

function stampPublishedLayout(
  layout: HomepageLayout,
  options?: { updatedBy?: string }
): HomepageLayout {
  const websiteConfig = layout.websiteConfig;
  if (!websiteConfig) {
    return layout;
  }
  return {
    ...layout,
    websiteConfig: {
      ...websiteConfig,
      versioning: {
        ...(websiteConfig.versioning || {}),
        publishedAt: new Date().toISOString(),
        updatedBy: options?.updatedBy ?? null,
      },
    },
  };
}

async function fetchHomepageConfigFromCloud(storeId: string): Promise<HomepageConfig | null> {
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
}

/** Public storefront: always load published (live) layout from Supabase — never localStorage. */
export async function getPublishedHomepageConfig(
  storeId: string
): Promise<Pick<HomepageConfig, 'publishedLayout' | 'publishedAt' | 'layout'> | null> {
  if (!isPersistedStoreId(storeId)) return null;

  try {
    return await withRetry(async () => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from(TABLE)
        .select('published_layout, published_at, layout')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch published homepage: ${error.message}`);
      }
      if (!data) return null;

      return {
        publishedLayout: (data.published_layout as HomepageLayout) || undefined,
        publishedAt: (data.published_at as string) || null,
        layout: data.layout as HomepageLayout,
      };
    });
  } catch {
    return null;
  }
}

async function publishHomepageConfigToCloud(
  storeId: string,
  layout: HomepageLayout,
  options?: { updatedBy?: string; note?: string }
): Promise<HomepageConfig> {
  const client = getSupabaseClient();
  const { data: existing, error: fetchError } = await client
    .from(TABLE)
    .select('id, layout, publish_history')
    .eq('store_id', storeId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message || 'Failed to publish homepage config');
  }

  const nextLayout = stampPublishedLayout(
    layout || (existing?.layout as HomepageLayout) || ({ sections: [], theme: {} } as HomepageLayout),
    options
  );
  const publishedAt = new Date().toISOString();
  const historyEntry = {
    id: `pub-${Date.now()}`,
    publishedAt,
    layout: nextLayout,
    note: options?.note,
  };
  const priorHistory = Array.isArray(existing?.publish_history) ? existing.publish_history : [];
  const publishHistory = [historyEntry, ...priorHistory].slice(0, 20);

  const patch = {
    layout: nextLayout,
    theme_settings: nextLayout?.theme,
    published_layout: nextLayout,
    published_at: publishedAt,
    publish_history: publishHistory,
    updated_at: publishedAt,
  };

  if (existing?.id) {
    const { data, error } = await client
      .from(TABLE)
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message || 'Failed to publish homepage config');
    return mapHomepageConfigRow(data as Record<string, unknown>);
  }

  const { data, error } = await client
    .from(TABLE)
    .insert({
      store_id: storeId,
      ...patch,
    })
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to publish homepage config');
  return mapHomepageConfigRow(data as Record<string, unknown>);
}

async function unpublishHomepageConfigOnCloud(storeId: string): Promise<HomepageConfig> {
  const client = getSupabaseClient();
  const { data: existing, error: fetchError } = await client
    .from(TABLE)
    .select('id')
    .eq('store_id', storeId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message || 'Failed to unpublish homepage config');
  if (!existing?.id) throw new Error('Homepage config not found');

  const { data, error } = await client
    .from(TABLE)
    .update({
      published_layout: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to unpublish homepage config');
  return mapHomepageConfigRow(data as Record<string, unknown>);
}

export async function getHomepageConfig(storeId: string): Promise<HomepageConfig | null> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    const local = localGetHomepageConfig(storeId);
    if (local) return local;
    if (isPersistedStoreId(storeId)) {
      try {
        return await fetchHomepageConfigFromCloud(storeId);
      } catch {
        return null;
      }
    }
    return null;
  }
  return withRetry(() => fetchHomepageConfigFromCloud(storeId));
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
    const local = localPublishHomepageConfig(configId, layout, options);
    if (isPersistedStoreId(local.storeId)) {
      await publishHomepageConfigToCloud(local.storeId, layout || local.layout, options);
    }
    return local;
  }

  const client = getSupabaseClient();
  const { data: row, error: rowError } = await client
    .from(TABLE)
    .select('store_id')
    .eq('id', configId)
    .maybeSingle();
  if (rowError || !row?.store_id) {
    throw new Error(rowError?.message || 'Homepage config not found');
  }
  return publishHomepageConfigToCloud(row.store_id as string, layout, options);
}

export async function unpublishHomepageConfig(configId: string): Promise<HomepageConfig> {
  if (USE_LOCAL_HOMEPAGE_STORE) {
    const local = localUnpublishHomepageConfig(configId);
    if (isPersistedStoreId(local.storeId)) {
      await unpublishHomepageConfigOnCloud(local.storeId);
    }
    return local;
  }

  const client = getSupabaseClient();
  const { data: row, error: rowError } = await client
    .from(TABLE)
    .select('store_id')
    .eq('id', configId)
    .maybeSingle();
  if (rowError || !row?.store_id) {
    throw new Error(rowError?.message || 'Homepage config not found');
  }
  return unpublishHomepageConfigOnCloud(row.store_id as string);
}

export async function restoreHomepageVersion(
  configId: string,
  versionId: string,
  target: 'draft' | 'live' = 'draft'
): Promise<HomepageConfig> {
  if (!versionId) throw new Error('versionId is required');
  if (USE_LOCAL_HOMEPAGE_STORE) {
    const local = localRestoreHomepageVersion(configId, versionId, target);
    if (target === 'live' && isPersistedStoreId(local.storeId) && local.publishedLayout) {
      await publishHomepageConfigToCloud(local.storeId, local.publishedLayout);
    }
    return local;
  }
  const client = getSupabaseClient();

  const { data: existing, error: fetchError } = await client
    .from(TABLE)
    .select('publish_history, store_id')
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
