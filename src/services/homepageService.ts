import { getSupabaseClient } from '../supabaseClient';
import { HomepageConfig, HomepageLayout } from '../types/homepage';

export async function getHomepageConfig(storeId: string): Promise<HomepageConfig | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('store_homepage_configs')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows returned
    throw error;
  }

  return data as HomepageConfig;
}

export async function createHomepageConfig(
  storeId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('store_homepage_configs')
    .insert({
      store_id: storeId,
      layout,
      theme_settings: layout.theme,
    })
    .select()
    .single();

  if (error) throw error;
  return data as HomepageConfig;
}

export async function updateHomepageLayout(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('store_homepage_configs')
    .update({
      layout,
      theme_settings: layout.theme,
      updated_at: new Date().toISOString(),
    })
    .eq('id', configId)
    .select()
    .single();

  if (error) throw error;
  return data as HomepageConfig;
}

export async function autoSaveHomepage(
  configId: string,
  layout: HomepageLayout
): Promise<HomepageConfig> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('store_homepage_configs')
    .update({
      layout,
      theme_settings: layout.theme,
      auto_saved_at: new Date().toISOString(),
    })
    .eq('id', configId)
    .select()
    .single();

  if (error) throw error;
  return data as HomepageConfig;
}

export async function deleteHomepageConfig(configId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('store_homepage_configs')
    .delete()
    .eq('id', configId);

  if (error) throw error;
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
