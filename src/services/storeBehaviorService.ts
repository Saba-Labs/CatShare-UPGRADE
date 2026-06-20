import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import {
  readCachedBehaviorSettings,
  writeCachedBehaviorSettings,
} from '../utils/storePageCache';
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  normalizeBehaviorSettings,
  type StoreBehaviorSettings,
} from '../types/storeBehaviorSettings';

export async function fetchBehaviorSettings(
  sellerUserId: string
): Promise<{ data: StoreBehaviorSettings; error: unknown }> {
  const trimmed = String(sellerUserId ?? '').trim();
  const cached = trimmed ? readCachedBehaviorSettings(trimmed) : null;

  if (!trimmed) {
    return { data: { ...DEFAULT_BEHAVIOR_SETTINGS }, error: new Error('Seller user ID is required') };
  }

  if (!isBrowserOnline()) {
    return { data: cached ?? { ...DEFAULT_BEHAVIOR_SETTINGS }, error: null };
  }

  try {
    setSupabaseRlsUserId(trimmed);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('behavior_settings')
      .eq('seller_user_id', trimmed)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('behavior_settings')) {
        const fallback = cached ?? { ...DEFAULT_BEHAVIOR_SETTINGS };
        writeCachedBehaviorSettings(trimmed, fallback);
        return { data: fallback, error: null };
      }
      if (cached) return { data: cached, error: null };
      return { data: { ...DEFAULT_BEHAVIOR_SETTINGS }, error };
    }

    const normalized = normalizeBehaviorSettings(data?.behavior_settings);
    writeCachedBehaviorSettings(trimmed, normalized);
    return {
      data: normalized,
      error: null,
    };
  } catch (e) {
    if (cached) return { data: cached, error: null };
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
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('behavior_settings')) {
        writeCachedBehaviorSettings(sellerUserId, normalized);
        return { data: normalized, error: null };
      }
      return { data: null, error };
    }

    if (!data) {
      return { data: null, error: 'Store not found' };
    }

    const saved = normalizeBehaviorSettings(data?.behavior_settings);
    writeCachedBehaviorSettings(sellerUserId, saved);
    return {
      data: saved,
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
