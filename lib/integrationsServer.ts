/**
 * Server-side helpers for integration API routes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeIntegrationRow, sanitizeIntegrationRows } from './integrationsMetadata.js';
import { syncStoreIntegrationFlags } from './storeIntegrationFlags.js';

export type IntegrationProviderId = 'razorpay' | 'shiprocket';

const PROVIDER_CATEGORY: Record<IntegrationProviderId, string> = {
  razorpay: 'payments',
  shiprocket: 'shipping',
};

export function isValidProvider(id: string): id is IntegrationProviderId {
  return id === 'razorpay' || id === 'shiprocket';
}

export function categoryForProvider(id: IntegrationProviderId): string {
  return PROVIDER_CATEGORY[id];
}

export function stubRazorpayMetadata(): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    accountName: 'Demo Merchant',
    businessName: 'CatShare Seller (Demo)',
    email: 'merchant@example.com',
    phone: '+91 98765 43210',
    merchantId: `rzp_demo_${Date.now().toString(36)}`,
    accountStatus: 'activated',
    connectionDate: now,
    isDemo: true,
  };
}

export function stubShiprocketMetadata(): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    warehouseName: 'Primary Warehouse',
    pickupAddress: '123 Commerce Street, Mumbai, Maharashtra 400001',
    connectionDate: now,
    isDemo: true,
  };
}

export async function upsertIntegration(
  supabase: SupabaseClient,
  sellerUserId: string,
  provider: IntegrationProviderId,
  patch: {
    status: string;
    account_id?: string | null;
    metadata?: Record<string, unknown>;
    connected_at?: string | null;
  }
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const row = {
    seller_user_id: sellerUserId,
    provider,
    category: categoryForProvider(provider),
    status: patch.status,
    account_id: patch.account_id ?? null,
    metadata: patch.metadata ?? {},
    connected_at: patch.connected_at ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('seller_integrations')
    .upsert(row, { onConflict: 'seller_user_id,provider' })
    .select()
    .single();

  if (error) throw error;
  await syncStoreIntegrationFlags(supabase, sellerUserId).catch(() => undefined);
  return sanitizeIntegrationRow(data as Record<string, unknown>);
}

export async function listIntegrations(
  supabase: SupabaseClient,
  sellerUserId: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('seller_integrations')
    .select('*')
    .eq('seller_user_id', sellerUserId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return sanitizeIntegrationRows((data ?? []) as Record<string, unknown>[]);
}

export async function deleteIntegration(
  supabase: SupabaseClient,
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<void> {
  const { error } = await supabase
    .from('seller_integrations')
    .delete()
    .eq('seller_user_id', sellerUserId)
    .eq('provider', provider);

  if (error) throw error;
  await syncStoreIntegrationFlags(supabase, sellerUserId).catch(() => undefined);
}

export async function getIntegration(
  supabase: SupabaseClient,
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('seller_integrations')
    .select('*')
    .eq('seller_user_id', sellerUserId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
}
