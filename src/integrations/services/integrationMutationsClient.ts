/**
 * Client-side connect / disconnect / refresh via Supabase RLS (MVP stub).
 * Used when /api/integrations is unavailable (local dev without Vercel API).
 */
import { getSupabaseClient, setSupabaseRlsUserId } from '../../supabaseClient';
import type { IntegrationProviderId } from '../core/types';
import type { SellerIntegrationRow } from './sellerIntegrationsService';

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

export async function connectIntegrationClient(
  sellerUserId: string,
  provider: IntegrationProviderId
): Promise<{ data: SellerIntegrationRow | null; error: string | null }> {
  try {
    if (!sellerUserId?.trim()) {
      return { data: null, error: 'Sign in to connect integrations.' };
    }
    setSupabaseRlsUserId(sellerUserId);

    if (provider === 'razorpay') {
      return {
        data: null,
        error:
          'Razorpay requires API credentials. Use the connect form on the Razorpay page.',
      };
    } else {
      return {
        data: null,
        error:
          'Shiprocket requires API credentials. Use the connect form on the Shiprocket page.',
      };
    }

    return {
      data: null,
      error: 'Connect is available only via server integrations API.',
    };
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

    if (provider === 'razorpay') {
      return {
        data: null,
        error: 'Use Refresh on the Razorpay page (requires server API).',
      };
    } else if (provider === 'shiprocket') {
      return {
        data: null,
        error: 'Use Refresh on the Shiprocket page (requires server API).',
      };
    }
    return { data: null, error: 'Refresh is available only via server integrations API.' };
  } catch (e) {
    return { data: null, error: formatIntegrationMutationError(e) };
  }
}
