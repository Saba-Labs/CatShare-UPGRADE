import { HomepageConfig, HomepageLayout } from '../types/homepage';
import { withRetry } from '../utils/retry';

export async function getHomepageConfig(storeId: string): Promise<HomepageConfig | null> {
  return withRetry(async () => {
    console.log('[getHomepageConfig] Fetching for storeId:', storeId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/homepage-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', storeId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let error;
        try {
          error = JSON.parse(text);
        } catch {
          error = { error: text };
        }
        throw new Error(error.error || `Failed to fetch config (${response.status})`);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[getHomepageConfig] Fetch error:', msg);
      throw new Error(`Failed to fetch homepage config: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

export async function createHomepageConfig(
  storeId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/homepage-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          storeId,
          layout,
          themeSettings: layout.theme,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let error;
        try {
          error = JSON.parse(text);
        } catch {
          error = { error: text };
        }
        throw new Error(error.error || `Failed to create config (${response.status})`);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[createHomepageConfig] Fetch error:', msg);
      throw new Error(`Failed to create homepage config: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

export async function updateHomepageLayout(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/homepage-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          configId,
          layout,
          themeSettings: layout.theme,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let error;
        try {
          error = JSON.parse(text);
        } catch {
          error = { error: text };
        }
        throw new Error(error.error || `Failed to update config (${response.status})`);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[updateHomepageLayout] Fetch error:', msg);
      throw new Error(`Failed to update homepage config: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

export async function autoSaveHomepage(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/homepage-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          configId,
          layout,
          themeSettings: layout.theme,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let error;
        try {
          error = JSON.parse(text);
        } catch {
          error = { error: text };
        }
        throw new Error(error.error || `Failed to save config (${response.status})`);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[autoSaveHomepage] Fetch error:', msg);
      throw new Error(`Failed to auto-save homepage: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
    }
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
  const existing = await getHomepageConfig(configId);
  if (!existing) throw new Error('Homepage config not found');
  return createHomepageConfig(newStoreId, existing.layout);
}
