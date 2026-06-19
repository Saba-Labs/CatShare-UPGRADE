/**
 * Shipping preferences stored on stores.shipping_preferences JSONB.
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import { isBrowserOnline } from '../../utils/cloudWritePolicy';
import {
  readCachedShippingPreferences,
  writeCachedShippingPreferences,
} from '../../utils/storePageCache';
import {
  DEFAULT_SHIPPING_PREFERENCES,
  EMPTY_SHIPPING_ADDRESS,
  type ShippingAddress,
  type ShippingPreferences,
  type ShippingPreferenceMode,
  type ShippingZoneRule,
} from '../core/types';

function normalizeMode(raw: unknown): ShippingPreferenceMode {
  if (raw === 'free' || raw === 'flat' || raw === 'actual') return raw;
  return 'actual';
}

function normalizeAddress(raw: unknown): ShippingAddress {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_SHIPPING_ADDRESS };
  }
  const r = raw as Record<string, unknown>;
  return {
    contactName: typeof r.contactName === 'string' ? r.contactName : '',
    phone: typeof r.phone === 'string' ? r.phone : '',
    line1: typeof r.line1 === 'string' ? r.line1 : '',
    line2: typeof r.line2 === 'string' ? r.line2 : '',
    city: typeof r.city === 'string' ? r.city : '',
    state: typeof r.state === 'string' ? r.state : '',
    pincode: typeof r.pincode === 'string' ? r.pincode : '',
    country: typeof r.country === 'string' && r.country.trim() ? r.country : 'IN',
  };
}

function normalizeZone(raw: unknown, index: number): ShippingZoneRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return null;
  return {
    id: typeof r.id === 'string' && r.id.trim() ? r.id : `zone-${index}`,
    name,
    regions: typeof r.regions === 'string' ? r.regions : '',
    enabled: r.enabled !== false,
  };
}

function normalizeNonNegativeNumber(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function normalizePositiveInt(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.round(n);
}

export function normalizeShippingPreferences(raw: unknown): ShippingPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SHIPPING_PREFERENCES };
  }

  const r = raw as Record<string, unknown>;
  const mode = normalizeMode(r.mode);
  const prefs: ShippingPreferences = {
    ...DEFAULT_SHIPPING_PREFERENCES,
    mode,
    warehouseAddress: normalizeAddress(r.warehouseAddress),
    pickupAddress: normalizeAddress(r.pickupAddress),
    useSameAddressForPickup: r.useSameAddressForPickup !== false,
    serviceCharge: normalizeNonNegativeNumber(r.serviceCharge),
    packagingCharge: normalizeNonNegativeNumber(r.packagingCharge),
    handlingCharge: normalizeNonNegativeNumber(r.handlingCharge),
    estimatedDeliveryMinDays: normalizePositiveInt(r.estimatedDeliveryMinDays, 3),
    estimatedDeliveryMaxDays: normalizePositiveInt(r.estimatedDeliveryMaxDays, 7),
    trackingEnabled: r.trackingEnabled !== false,
    notifyCustomerOnShip: r.notifyCustomerOnShip !== false,
    showTrackingLink: r.showTrackingLink !== false,
    shippingZones: Array.isArray(r.shippingZones)
      ? r.shippingZones
          .map((zone, index) => normalizeZone(zone, index))
          .filter((zone): zone is ShippingZoneRule => zone !== null)
      : [...DEFAULT_SHIPPING_PREFERENCES.shippingZones],
  };

  if (mode === 'flat' && r.flatAmount != null) {
    prefs.flatAmount = normalizeNonNegativeNumber(r.flatAmount);
  }
  if (mode === 'free' && r.freeAboveAmount != null) {
    prefs.freeAboveAmount = normalizeNonNegativeNumber(r.freeAboveAmount);
  }

  if (prefs.estimatedDeliveryMinDays > prefs.estimatedDeliveryMaxDays) {
    prefs.estimatedDeliveryMaxDays = prefs.estimatedDeliveryMinDays;
  }

  if (prefs.shippingZones.length === 0) {
    prefs.shippingZones = [...DEFAULT_SHIPPING_PREFERENCES.shippingZones];
  }

  return prefs;
}

export async function fetchShippingPreferences(
  sellerUserId: string
): Promise<{ data: ShippingPreferences; error: unknown }> {
  const trimmed = String(sellerUserId ?? '').trim();
  const cached = trimmed ? readCachedShippingPreferences(trimmed) : null;

  if (!trimmed) {
    return { data: { ...DEFAULT_SHIPPING_PREFERENCES }, error: new Error('Seller user ID is required') };
  }

  if (!isBrowserOnline()) {
    return { data: cached ?? { ...DEFAULT_SHIPPING_PREFERENCES }, error: null };
  }

  try {
    setSupabaseRlsUserId(trimmed);
    const { data, error } = await getSupabaseClient()
      .from('stores')
      .select('shipping_preferences')
      .eq('seller_user_id', trimmed)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('shipping_preferences')) {
        const fallback = cached ?? { ...DEFAULT_SHIPPING_PREFERENCES };
        writeCachedShippingPreferences(trimmed, fallback);
        return { data: fallback, error: null };
      }
      if (cached) return { data: cached, error: null };
      return { data: { ...DEFAULT_SHIPPING_PREFERENCES }, error };
    }

    const normalized = normalizeShippingPreferences(data?.shipping_preferences);
    writeCachedShippingPreferences(trimmed, normalized);
    return {
      data: normalized,
      error: null,
    };
  } catch (e) {
    if (cached) return { data: cached, error: null };
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
    const saved = normalizeShippingPreferences(data?.shipping_preferences);
    writeCachedShippingPreferences(sellerUserId, saved);
    return {
      data: saved,
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
