import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from './integrationSecrets.js';
import { getIntegration, upsertIntegration } from './integrationsServer.js';
import { sanitizeIntegrationRow } from './integrationsMetadata.js';
import { fetchRazorpayAccountProfile, createRazorpayOrder, verifyRazorpayPaymentSignature } from './razorpayServer.js';

type RazorpayServerMetadata = {
  keyIdMasked?: string;
  keyMode?: 'test' | 'live';
  encryptedKeyId?: string;
  encryptedKeySecret?: string;
  merchantId?: string;
  accountName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  accountStatus?: string;
  connectionDate?: string;
  lastVerifiedAt?: string;
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
    keyMode: profile.keyMode,
    encryptedKeyId: encryptSecret(keyId),
    encryptedKeySecret: encryptSecret(keySecret),
    merchantId: profile.id,
    accountName: profile.name,
    businessName: profile.name,
    email: profile.email,
    phone: profile.phone,
    accountStatus: 'active',
    connectionDate: now,
    lastVerifiedAt: now,
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

function getRazorpayKeys(metadata: RazorpayServerMetadata): { keyId: string; keySecret: string } {
  if (metadata.isDemo) {
    throw new Error('Reconnect Razorpay with your API keys in Store settings');
  }
  if (!metadata.encryptedKeyId || !metadata.encryptedKeySecret) {
    throw new Error('Missing stored Razorpay keys — reconnect in Store settings');
  }
  return {
    keyId: decryptSecret(metadata.encryptedKeyId),
    keySecret: decryptSecret(metadata.encryptedKeySecret),
  };
}

type StoreOrderRow = {
  id: string;
  seller_user_id: string;
  customer_name: string;
  customer_whatsapp?: string;
  total_amount?: number;
  currency_code?: string;
  payment_method?: string;
  order_source?: string;
  checkout_adjustments?: { grandTotal?: number };
};

export async function beginRazorpayCheckoutForOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<{
  keyId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
}> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) throw new Error('Order not found');

  const orderRow = order as StoreOrderRow;
  if (orderRow.order_source !== 'store' && orderRow.order_source !== 'link') {
    throw new Error('Online payment is only available for store and order-link checkout');
  }
  if (orderRow.payment_method !== 'prepaid') {
    throw new Error('This order is not a prepaid checkout');
  }

  const integrationRow = await getIntegration(supabase, orderRow.seller_user_id, 'razorpay');
  if (!integrationRow || integrationRow.status !== 'connected') {
    throw new Error('Seller has not connected Razorpay');
  }

  const metadata = asMetadata(integrationRow.metadata);
  const { keyId, keySecret } = getRazorpayKeys(metadata);

  const grandTotal =
    Number(orderRow.checkout_adjustments?.grandTotal ?? orderRow.total_amount ?? 0) || 0;
  if (grandTotal < 1) {
    throw new Error('Order amount is too small for online payment');
  }

  const currency = String(orderRow.currency_code ?? 'INR').toUpperCase();
  const amountPaise = Math.round(grandTotal * 100);
  const receipt = `cs-${String(orderRow.id).replace(/-/g, '').slice(0, 24)}`;

  const razorpayOrder = await createRazorpayOrder(keyId, keySecret, {
    amountPaise,
    currency,
    receipt,
    notes: { catshare_order_id: String(orderRow.id) },
  });

  const now = new Date().toISOString();
  await supabase.from('order_payments').upsert(
    {
      order_id: orderRow.id,
      seller_user_id: orderRow.seller_user_id,
      provider: 'razorpay',
      status: 'pending',
      provider_order_id: razorpayOrder.id,
      amount: grandTotal,
      currency,
      payment_method: 'prepaid',
      customer_name: orderRow.customer_name,
      customer_phone: orderRow.customer_whatsapp ?? null,
      metadata: { receipt },
      updated_at: now,
    },
    { onConflict: 'order_id' }
  );

  return {
    keyId,
    amount: amountPaise,
    currency,
    razorpayOrderId: razorpayOrder.id,
    orderId: String(orderRow.id),
    customerName: orderRow.customer_name,
    customerPhone: String(orderRow.customer_whatsapp ?? ''),
  };
}

export async function confirmRazorpayCheckoutForOrder(
  supabase: SupabaseClient,
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<Record<string, unknown>> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) throw new Error('Order not found');

  const orderRow = order as StoreOrderRow;
  const integrationRow = await getIntegration(supabase, orderRow.seller_user_id, 'razorpay');
  if (!integrationRow || integrationRow.status !== 'connected') {
    throw new Error('Seller has not connected Razorpay');
  }

  const { keySecret } = getRazorpayKeys(asMetadata(integrationRow.metadata));
  const valid = verifyRazorpayPaymentSignature(
    keySecret,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  );
  if (!valid) {
    throw new Error('Payment verification failed');
  }

  const now = new Date().toISOString();
  const { data: paymentRow, error: payErr } = await supabase
    .from('order_payments')
    .upsert(
      {
        order_id: orderRow.id,
        seller_user_id: orderRow.seller_user_id,
        provider: 'razorpay',
        status: 'paid',
        payment_id: razorpayPaymentId,
        provider_order_id: razorpayOrderId,
        amount: Number(orderRow.checkout_adjustments?.grandTotal ?? orderRow.total_amount ?? 0),
        currency: String(orderRow.currency_code ?? 'INR'),
        payment_method: 'prepaid',
        customer_name: orderRow.customer_name,
        customer_phone: orderRow.customer_whatsapp ?? null,
        paid_at: now,
        updated_at: now,
      },
      { onConflict: 'order_id' }
    )
    .select()
    .single();

  if (payErr) throw payErr;
  return paymentRow as Record<string, unknown>;
}
