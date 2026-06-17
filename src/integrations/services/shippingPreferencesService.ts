/**
 * Shipping preferences stored on stores.shipping_preferences JSONB.
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import {
  DEFAULT_SHIPPING_PREFERENCES,
  type ShippingPreferences,
  type ShippingPreferenceMode,
} from '../core/types';

function normalizeMode(raw: unknown): ShippingPreferenceMode {
  if (raw === 'free' || raw === 'flat' || raw === 'actual') return raw;
  return 'actual';
}

export function normalizeShippingPreferences(raw: unknown): ShippingPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SHIPPING_PREFERENCES };
  }
  const r = raw as Record<string, unknown>;
  const mode = normalizeMode(r.mode);
  const prefs: ShippingPreferences = { mode };
  if (mode === 'flat' && r.flatAmount != null) {
    const n = Number(r.flatAmount);
    if (Number.isFinite(n) && n >= 0) prefs.flatAmount = n;
  }
  if (mode === 'free' && r.freeAboveAmount != null) {
    const n = Number(r.freeAboveAmount);
    if (Number.isFinite(n) && n >= 0) prefs.freeAboveAmount = n;
  }
  return prefs;
}

export async function fetchShippingPreferences(
  sellerUserId: string
): Promise<{ data: ShippingPreferences; error: unknown }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('shipping_preferences')
      .eq('seller_user_id', sellerUserId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('shipping_preferences')) {
        return { data: { ...DEFAULT_SHIPPING_PREFERENCES }, error: null };
      }
      return { data: { ...DEFAULT_SHIPPING_PREFERENCES }, error };
    }

    return {
      data: normalizeShippingPreferences(data?.shipping_preferences),
      error: null,
    };
  } catch (e) {
    return { data: { ...DEFAULT_SHIPPING_PREFERENCES }, error: e };
  }
}

export async function updateShippingPreferences(
  sellerUserId: string,
  preferences: ShippingPreferences
): Promise<{ data: ShippingPreferences | null; error: unknown }> {
  try {
    const normalized = normalizeShippingPreferences(preferences);
    setSupabaseRlsUserId(sellerUserId);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .update({
        shipping_preferences: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_user_id', sellerUserId)
      .select('shipping_preferences')
      .single();

    if (error) return { data: null, error };
    return {
      data: normalizeShippingPreferences(data?.shipping_preferences),
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

export function summarizeShippingPreferences(prefs: ShippingPreferences): string {
  switch (prefs.mode) {
    case 'actual':
      return 'Charge actual shipping cost';
    case 'free':
      return prefs.freeAboveAmount != null && prefs.freeAboveAmount > 0
        ? `Free shipping above ₹${prefs.freeAboveAmount}`
        : 'Free shipping';
    case 'flat':
      return prefs.flatAmount != null
        ? `Flat ₹${prefs.flatAmount} shipping`
        : 'Flat shipping rate';
    default:
      return 'Shipping preferences';
  }
}
