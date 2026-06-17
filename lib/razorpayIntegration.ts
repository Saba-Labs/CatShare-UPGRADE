import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from './integrationSecrets.js';
import { getIntegration, upsertIntegration } from './integrationsServer.js';
import { sanitizeIntegrationRow } from './integrationsMetadata.js';
import { fetchRazorpayAccountProfile } from './razorpayServer.js';

type RazorpayServerMetadata = {
  keyIdMasked?: string;
  encryptedKeyId?: string;
  encryptedKeySecret?: string;
  merchantId?: string;
  accountName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  accountStatus?: string;
  connectionDate?: string;
  lastError?: string | null;
  isDemo?: boolean;
};

function asMetadata(raw: unknown): RazorpayServerMetadata {
  if (!raw || typeof raw !== 'object') return {};
  return raw as RazorpayServerMetadata;
}

function maskKeyId(keyId: string): string {
  const trimmed = keyId.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 3)}***`;
  return `${trimmed.slice(0, 8)}***`;
}

async function buildMetadata(
  keyId: string,
  keySecret: string
): Promise<RazorpayServerMetadata> {
  const profile = await fetchRazorpayAccountProfile(keyId, keySecret);
  const now = new Date().toISOString();
  return {
    keyIdMasked: maskKeyId(keyId),
    encryptedKeyId: encryptSecret(keyId),
    encryptedKeySecret: encryptSecret(keySecret),
    merchantId: profile.id ?? null ?? undefined,
    accountName: profile.name ?? null ?? undefined,
    businessName: profile.name ?? null ?? undefined,
    email: profile.email ?? null ?? undefined,
    phone: profile.phone ?? null ?? undefined,
    accountStatus: 'active',
    connectionDate: now,
    lastError: null,
    isDemo: false,
  };
}

export async function connectRazorpayIntegration(
  supabase: SupabaseClient,
  sellerUserId: string,
  keyId: string,
  keySecret: string
): Promise<Record<string, unknown>> {
  if (!keyId.trim() || !keySecret) {
    throw new Error('Razorpay Key ID and Key Secret are required');
  }

  const metadata = await buildMetadata(keyId.trim(), keySecret);
  const integration = await upsertIntegration(supabase, sellerUserId, 'razorpay', {
    status: 'connected',
    account_id: String(metadata.merchantId ?? ''),
    metadata,
    connected_at: new Date().toISOString(),
  });
  return sanitizeIntegrationRow(integration);
}

export async function refreshRazorpayIntegration(
  supabase: SupabaseClient,
  sellerUserId: string
): Promise<Record<string, unknown>> {
  const existing = await getIntegration(supabase, sellerUserId, 'razorpay');
  if (!existing) {
    throw new Error('Integration not connected');
  }
  const existingMeta = asMetadata(existing.metadata);
  if (existingMeta.isDemo) {
    throw new Error('Reconnect with live Razorpay credentials');
  }
  if (!existingMeta.encryptedKeyId || !existingMeta.encryptedKeySecret) {
    throw new Error('Missing stored Razorpay keys — disconnect and reconnect');
  }

  const keyId = decryptSecret(existingMeta.encryptedKeyId);
  const keySecret = decryptSecret(existingMeta.encryptedKeySecret);
  const metadata = await buildMetadata(keyId, keySecret);

  const integration = await upsertIntegration(supabase, sellerUserId, 'razorpay', {
    status: 'connected',
    account_id:
      existing.account_id != null ? String(existing.account_id) : String(metadata.merchantId ?? ''),
    metadata: { ...existingMeta, ...metadata },
    connected_at:
      existing.connected_at != null ? String(existing.connected_at) : new Date().toISOString(),
  });
  return sanitizeIntegrationRow(integration);
}
