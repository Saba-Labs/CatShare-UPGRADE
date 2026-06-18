import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  normalizeBehaviorSettings,
  type StoreBehaviorSettings,
} from '../types/storeBehaviorSettings';

export async function fetchBehaviorSettings(
  sellerUserId: string
): Promise<{ data: StoreBehaviorSettings; error: unknown }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('behavior_settings')
      .eq('seller_user_id', sellerUserId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('behavior_settings')) {
        return { data: { ...DEFAULT_BEHAVIOR_SETTINGS }, error: null };
      }
      return { data: { ...DEFAULT_BEHAVIOR_SETTINGS }, error };
    }

    return {
      data: normalizeBehaviorSettings(data?.behavior_settings),
      error: null,
    };
  } catch (e) {
    return { data: { ...DEFAULT_BEHAVIOR_SETTINGS }, error: e };
  }
}

export async function updateBehaviorSettings(
  sellerUserId: string,
  settings: StoreBehaviorSettings
): Promise<{ data: StoreBehaviorSettings | null; error: unknown }> {
  try {
    const normalized = normalizeBehaviorSettings(settings);
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .update({
        behavior_settings: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select('behavior_settings')
      .single();

    if (error) {
      if (error.code === '42703' || error.message?.includes('behavior_settings')) {
        return { data: normalized, error: null };
      }
      return { data: null, error };
    }

    return {
      data: normalizeBehaviorSettings(data?.behavior_settings),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
