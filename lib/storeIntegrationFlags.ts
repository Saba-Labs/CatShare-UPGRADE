import type { SupabaseClient } from '@supabase/supabase-js';

export type StoreIntegrationFlags = {
  razorpay: boolean;
  shiprocket: boolean;
};

const DEFAULT_FLAGS: StoreIntegrationFlags = {
  razorpay: false,
  shiprocket: false,
};

export function normalizeStoreIntegrationFlags(raw: unknown): StoreIntegrationFlags {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FLAGS };
  const o = raw as Record<string, unknown>;
  return {
    razorpay: o.razorpay === true,
    shiprocket: o.shiprocket === true,
  };
}

export async function syncStoreIntegrationFlags(
  supabase: SupabaseClient,
  sellerUserId: string
): Promise<StoreIntegrationFlags> {
  const { data, error } = await supabase
    .from('seller_integrations')
    .select('provider, status, metadata')
    .eq('seller_user_id', sellerUserId);

  if (error) throw error;

  const flags: StoreIntegrationFlags = { razorpay: false, shiprocket: false };
  for (const row of data ?? []) {
    const provider = String((row as { provider?: string }).provider ?? '');
    const status = String((row as { status?: string }).status ?? '');
    const metadata = (row as { metadata?: Record<string, unknown> }).metadata ?? {};
    if (status !== 'connected' || metadata.isDemo === true) continue;
    if (provider === 'razorpay') flags.razorpay = true;
    if (provider === 'shiprocket') flags.shiprocket = true;
  }

  const { error: updateErr } = await supabase
    .from('stores')
    .update({
      integration_flags: flags,
      updated_at: new Date().toISOString(),
    })
    .eq('seller_user_id', sellerUserId);

  if (updateErr && !String(updateErr.message || '').includes('integration_flags')) {
    throw updateErr;
  }

  return flags;
}
