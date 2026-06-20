import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import {
  readCachedSecuritySettings,
  writeCachedSecuritySettings,
} from '../utils/storePageCache';
import {
  DEFAULT_SECURITY_SETTINGS,
  normalizeSecuritySettings,
  type StoreSecuritySettings,
} from '../types/storeSecuritySettings';

export async function fetchSecuritySettings(
  sellerUserId: string
): Promise<{ data: StoreSecuritySettings; error: unknown }> {
  const trimmed = String(sellerUserId ?? '').trim();
  const cached = trimmed ? readCachedSecuritySettings(trimmed) : null;

  if (!trimmed) {
    return { data: { ...DEFAULT_SECURITY_SETTINGS }, error: new Error('Seller user ID is required') };
  }

  if (!isBrowserOnline()) {
    return { data: cached ?? { ...DEFAULT_SECURITY_SETTINGS }, error: null };
  }

  try {
    setSupabaseRlsUserId(trimmed);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('security_settings')
      .eq('seller_user_id', trimmed)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('security_settings')) {
        const fallback = cached ?? { ...DEFAULT_SECURITY_SETTINGS };
        writeCachedSecuritySettings(trimmed, fallback);
        return { data: fallback, error: null };
      }
      if (cached) return { data: cached, error: null };
      return { data: { ...DEFAULT_SECURITY_SETTINGS }, error };
    }

    const normalized = normalizeSecuritySettings(data?.security_settings);
    writeCachedSecuritySettings(trimmed, normalized);
    return {
      data: normalized,
      error: null,
    };
  } catch (e) {
    if (cached) return { data: cached, error: null };
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
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('security_settings')) {
        writeCachedSecuritySettings(sellerUserId, normalized);
        return { data: normalized, error: null };
      }
      return { data: null, error };
    }

    if (!data) {
      return { data: null, error: 'Store not found' };
    }

    const saved = normalizeSecuritySettings(data?.security_settings);
    writeCachedSecuritySettings(sellerUserId, saved);
    return {
      data: saved,
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

/** Verify storefront password server-side (password never exposed on public store payload). */
export async function verifyStorePassword(
  storeSlug: string,
  password: string
): Promise<{ ok: boolean; error: unknown }> {
  const slug = String(storeSlug ?? '').trim().toLowerCase();
  if (!slug) {
    return { ok: false, error: new Error('store_slug_required') };
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('verify_store_password', {
      p_slug: slug,
      p_password: password,
    });

    if (error) {
      return { ok: false, error };
    }

    return { ok: data === true, error: null };
  } catch (e) {
    return { ok: false, error: e };
  }
}
