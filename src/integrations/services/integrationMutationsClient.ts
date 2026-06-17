/**
 * Client-side connect / disconnect / refresh via Supabase RLS (MVP stub).
 * Used when /api/integrations is unavailable (local dev without Vercel API).
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import type { IntegrationProviderId } from '../core/types';
import type { SellerIntegrationRow } from './sellerIntegrationsService';

function categoryFor(provider: IntegrationProviderId): string {
  return provider === 'razorpay' ? 'payments' : 'shipping';
}

function formatIntegrationMutationError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: string }).message ?? '');
    if (msg.includes('Failed to fetch')) {
      return 'Could not reach Supabase. Check your internet connection and VITE_SUPABASE_URL in .env.local.';
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code?: string }).code ?? '');
      if (code === '42P01' || msg.includes('seller_integrations')) {
        return 'Integrations tables are missing. Run sql/seller_integrations.sql in the Supabase SQL editor.';
      }
      if (code === '42501' || msg.toLowerCase().includes('row-level security')) {
        return 'Permission denied. Sign in again, then retry Connect.';
      }
    }
    return msg || 'Could not update integration';
  }
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Could not reach Supabase. Check your internet connection and VITE_SUPABASE_URL in .env.local.';
    }
    return error.message;
  }
  return 'Could not update integration';
}

function stubRazorpayMetadata(): Record<string, unknown> {
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

function stubShiprocketMetadata(): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    warehouseName: 'Primary Warehouse',
    pickupAddress: '123 Commerce Street, Mumbai, Maharashtra 400001',
    connectionDate: now,
    isDemo: true,
  };
}

export async function connectIntegrationClient(
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<{ data: SellerIntegrationRow | null; error: string | null }> {
  try {
    if (!sellerUserId?.trim()) {
      return { data: null, error: 'Sign in to connect integrations.' };
    }
    setSupabaseRlsUserId(sellerUserId);
    const now = new Date().toISOString();
    let status: string;
    let metadata: Record<string, unknown>;
    let accountId: string | null;

    if (provider === 'razorpay') {
      status = 'pending_verification';
      metadata = stubRazorpayMetadata();
      accountId = String(metadata.merchantId ?? '');
    } else {
      return {
        data: null,
        error:
          'Shiprocket requires API credentials. Use the connect form on the Shiprocket page.',
      };
    }

    const { data, error } = await getSupabaseClient()
      .from('seller_integrations')
      .upsert(
        {
          seller_user_id: sellerUserId,
          provider,
          category: categoryFor(provider),
          status,
          account_id: accountId,
          metadata,
          connected_at: now,
          updated_at: now,
        },
        { onConflict: 'seller_user_id,provider' }
      )
      .select()
      .single();

    if (error) return { data: null, error: formatIntegrationMutationError(error) };
    return { data: data as SellerIntegrationRow, error: null };
  } catch (e) {
    return { data: null, error: formatIntegrationMutationError(e) };
  }
}

export async function disconnectIntegrationClient(
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<{ error: string | null }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const { error } = await getSupabaseClient()
      .from('seller_integrations')
      .delete()
      .eq('seller_user_id', sellerUserId)
      .eq('provider', provider);

    if (error) return { error: formatIntegrationMutationError(error) };
    return { error: null };
  } catch (e) {
    return { error: formatIntegrationMutationError(e) };
  }
}

export async function refreshIntegrationClient(
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<{ data: SellerIntegrationRow | null; error: string | null }> {
  try {
    setSupabaseRlsUserId(sellerUserId);
    const { data: existing, error: readErr } = await getSupabaseClient()
      .from('seller_integrations')
      .select('*')
      .eq('seller_user_id', sellerUserId)
      .eq('provider', provider)
      .maybeSingle();

    if (readErr) return { data: null, error: formatIntegrationMutationError(readErr) };
    if (!existing) return { data: null, error: 'Integration not connected' };

    const now = new Date().toISOString();
    let status = String(existing.status ?? 'not_connected');
    let metadata =
      existing.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    if (provider === 'razorpay' && status === 'pending_verification') {
      status = 'connected';
      metadata = { ...stubRazorpayMetadata(), ...metadata, accountStatus: 'activated' };
    } else if (provider === 'shiprocket') {
      return {
        data: null,
        error: 'Use Refresh on the Shiprocket page (requires server API).',
      };
    }

    const { data, error } = await getSupabaseClient()
      .from('seller_integrations')
      .update({
        status,
        metadata,
        updated_at: now,
      })
      .eq('seller_user_id', sellerUserId)
      .eq('provider', provider)
      .select()
      .single();

    if (error) return { data: null, error: formatIntegrationMutationError(error) };
    return { data: data as SellerIntegrationRow, error: null };
  } catch (e) {
    return { data: null, error: formatIntegrationMutationError(e) };
  }
}
