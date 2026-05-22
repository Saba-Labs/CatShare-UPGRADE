import { HomepageConfig, HomepageLayout } from '../types/homepage';
import { withRetry } from '../utils/retry';

export async function getHomepageConfig(storeId: string): Promise<HomepageConfig | null> {
  return withRetry(async () => {
    console.log('[getHomepageConfig] Fetching for storeId:', storeId);

    const response = await fetch('/api/homepage-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', storeId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch config');
    }

    const { data } = await response.json();

    if (!data) return null;

    console.log('[getHomepageConfig] Success:', data);
    return {
      id: data.id,
      storeId: data.store_id,
      layout: data.layout,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      autoSavedAt: data.auto_saved_at,
    } as HomepageConfig;
  });
}

export async function createHomepageConfig(
  storeId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  return withRetry(async () => {
    const response = await fetch('/api/homepage-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        storeId,
        layout,
        themeSettings: layout.theme,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create config');
    }

    const { data } = await response.json();
    return {
      id: data.id,
      storeId: data.store_id,
      layout: data.layout,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      autoSavedAt: data.auto_saved_at,
    } as HomepageConfig;
  });
}

export async function updateHomepageLayout(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  return withRetry(async () => {
    const response = await fetch('/api/homepage-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        configId,
        layout,
        themeSettings: layout.theme,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update config');
    }

    const { data } = await response.json();
    return {
      id: data.id,
      storeId: data.store_id,
      layout: data.layout,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      autoSavedAt: data.auto_saved_at,
    } as HomepageConfig;
  });
}

export async function autoSaveHomepage(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  return withRetry(async () => {
    const response = await fetch('/api/homepage-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        configId,
        layout,
        themeSettings: layout.theme,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save config');
    }

    const { data } = await response.json();
    return {
      id: data.id,
      storeId: data.store_id,
      layout: data.layout,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      autoSavedAt: data.auto_saved_at,
    } as HomepageConfig;
  });
}

export async function deleteHomepageConfig(configId: string): Promise<void> {
  const response = await fetch('/api/homepage-config', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete config');
  }
}

export async function duplicateHomepageConfig(
  configId: string,
  newStoreId: string
): Promise<HomepageConfig> {
  const supabase = getSupabaseClient();

  // Fetch existing config
  const existing = await getHomepageConfig(configId);
  if (!existing) throw new Error('Homepage config not found');

  // Create new config with same layout but different store
  return createHomepageConfig(newStoreId, existing.layout);
}
