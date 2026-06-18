import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import {
  DEFAULT_MARKETING_SETTINGS,
  normalizeMarketingSettings,
  type StoreMarketingSettings,
} from '../types/storeMarketingSettings';

export async function fetchMarketingSettings(
  sellerUserId: string
): Promise<{ data: StoreMarketingSettings; error: unknown }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('marketing_settings')
      .eq('seller_user_id', sellerUserId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('marketing_settings')) {
        return { data: { ...DEFAULT_MARKETING_SETTINGS }, error: null };
      }
      return { data: { ...DEFAULT_MARKETING_SETTINGS }, error };
    }

    return {
      data: normalizeMarketingSettings(data?.marketing_settings),
      error: null,
    };
  } catch (e) {
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
      .single();

    if (error) {
      if (error.code === '42703' || error.message?.includes('marketing_settings')) {
        return { data: normalized, error: null };
      }
      return { data: null, error };
    }

    return {
      data: normalizeMarketingSettings(data?.marketing_settings),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
