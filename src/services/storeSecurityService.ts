import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import {
  DEFAULT_SECURITY_SETTINGS,
  normalizeSecuritySettings,
  type StoreSecuritySettings,
} from '../types/storeSecuritySettings';

export async function fetchSecuritySettings(
  sellerUserId: string
): Promise<{ data: StoreSecuritySettings; error: unknown }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('security_settings')
      .eq('seller_user_id', sellerUserId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('security_settings')) {
        return { data: { ...DEFAULT_SECURITY_SETTINGS }, error: null };
      }
      return { data: { ...DEFAULT_SECURITY_SETTINGS }, error };
    }

    return {
      data: normalizeSecuritySettings(data?.security_settings),
      error: null,
    };
  } catch (e) {
    return { data: { ...DEFAULT_SECURITY_SETTINGS }, error: e };
  }
}

export async function updateSecuritySettings(
  sellerUserId: string,
  settings: StoreSecuritySettings
): Promise<{ data: StoreSecuritySettings | null; error: unknown }> {
  try {
    const normalized = normalizeSecuritySettings(settings);
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .update({
        security_settings: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select('security_settings')
      .single();

    if (error) {
      if (error.code === '42703' || error.message?.includes('security_settings')) {
        return { data: normalized, error: null };
      }
      return { data: null, error };
    }

    return {
      data: normalizeSecuritySettings(data?.security_settings),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
