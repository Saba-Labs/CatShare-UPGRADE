import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import {
  readCachedMarketingSettings,
  writeCachedMarketingSettings,
} from '../utils/storePageCache';
import {
  DEFAULT_MARKETING_SETTINGS,
  normalizeMarketingSettings,
  type StoreMarketingSettings,
} from '../types/storeMarketingSettings';

export async function fetchMarketingSettings(
  sellerUserId: string
): Promise<{ data: StoreMarketingSettings; error: unknown }> {
  const trimmed = String(sellerUserId ?? '').trim();
  const cached = trimmed ? readCachedMarketingSettings(trimmed) : null;

  if (!trimmed) {
    return { data: { ...DEFAULT_MARKETING_SETTINGS }, error: new Error('Seller user ID is required') };
  }

  if (!isBrowserOnline()) {
    return { data: cached ?? { ...DEFAULT_MARKETING_SETTINGS }, error: null };
  }

  try {
    setSupabaseRlsUserId(trimmed);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('marketing_settings')
      .eq('seller_user_id', trimmed)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('marketing_settings')) {
        const fallback = cached ?? { ...DEFAULT_MARKETING_SETTINGS };
        writeCachedMarketingSettings(trimmed, fallback);
        return { data: fallback, error: null };
      }
      if (cached) return { data: cached, error: null };
      return { data: { ...DEFAULT_MARKETING_SETTINGS }, error };
    }

    const normalized = normalizeMarketingSettings(data?.marketing_settings);
    writeCachedMarketingSettings(trimmed, normalized);
    return {
      data: normalized,
      error: null,
    };
  } catch (e) {
    if (cached) return { data: cached, error: null };
    return { data: { ...DEFAULT_MARKETING_SETTINGS }, error: e };
  }
}

export async function updateMarketingSettings(
  sellerUserId: string,
  settings: StoreMarketingSettings
): Promise<{ data: StoreMarketingSettings | null; error: unknown }> {
  try {
    const normalized = normalizeMarketingSettings(settings);
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .update({
        marketing_settings: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select('marketing_settings')
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('marketing_settings')) {
        writeCachedMarketingSettings(sellerUserId, normalized);
        return { data: normalized, error: null };
      }
      return { data: null, error };
    }

    if (!data) {
      return { data: null, error: 'Store not found' };
    }

    const saved = normalizeMarketingSettings(data?.marketing_settings);
    writeCachedMarketingSettings(sellerUserId, saved);
    return {
      data: saved,
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
