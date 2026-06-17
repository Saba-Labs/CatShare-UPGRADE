/**
 * Shiprocket connect / token / shipment orchestration (server-only).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret, maskEmail } from './integrationSecrets.js';
import {
  assignShiprocketAwb,
  createShiprocketAdhocOrder,
  fetchShiprocketPickupLocations,
  formatPickupAddress,
  shiprocketLogin,
  ShiprocketApiError,
  type ShiprocketPickupLocation,
} from './shiprocketServer.js';
import {
  getIntegration,
  upsertIntegration,
  type IntegrationProviderId,
} from './integrationsServer.js';
import { sanitizeIntegrationRow } from './integrationsMetadata.js';

export type ShiprocketServerMetadata = {
  apiUserEmail?: string;
  apiUserEmailMasked?: string;
  encryptedPassword?: string;
  encryptedAccessToken?: string;
  tokenExpiresAt?: string;
  companyId?: string | number;
  pickupLocationId?: number;
  pickupLocationName?: string;
  warehouseName?: string;
  pickupAddress?: string;
  connectionDate?: string;
  isDemo?: boolean;
  lastError?: string | null;
};

function asMetadata(raw: unknown): ShiprocketServerMetadata {
  if (!raw || typeof raw !== 'object') return {};
  return raw as ShiprocketServerMetadata;
}

function pickPrimaryPickup(
  locations: ShiprocketPickupLocation[]
): ShiprocketPickupLocation | null {
  if (!locations.length) return null;
  return locations[0];
}

function buildShiprocketMetadata(
  email: string,
  password: string,
  auth: Awaited<ReturnType<typeof shiprocketLogin>>,
  pickup: ShiprocketPickupLocation | null
): ShiprocketServerMetadata {
  const now = new Date().toISOString();
  return {
    apiUserEmail: email.trim(),
    apiUserEmailMasked: maskEmail(email),
    encryptedPassword: encryptSecret(password),
    encryptedAccessToken: encryptSecret(auth.token),
    tokenExpiresAt: auth.expiresAt,
    companyId: auth.companyId ?? undefined,
    pickupLocationId: pickup?.id,
    pickupLocationName: pickup?.pickup_location,
    warehouseName: pickup?.pickup_location ?? 'Primary',
    pickupAddress: pickup ? formatPickupAddress(pickup) : null,
    connectionDate: now,
    isDemo: false,
    lastError: null,
  };
}

export async function connectShiprocketIntegration(
  supabase: SupabaseClient,
  sellerUserId: string,
  email: string,
  password: string
): Promise<Record<string, unknown>> {
  if (!email.trim() || !password) {
    throw new Error('Shiprocket API user email and password are required');
  }

  const auth = await shiprocketLogin(email, password);
  const locations = await fetchShiprocketPickupLocations(auth.token);
  const pickup = pickPrimaryPickup(locations);

  const integration = await upsertIntegration(
    supabase,
    sellerUserId,
    'shiprocket',
    {
      status: 'connected',
      account_id: auth.companyId != null ? String(auth.companyId) : null,
      metadata: buildShiprocketMetadata(email, password, auth, pickup),
      connected_at: new Date().toISOString(),
    }
  );

  return sanitizeIntegrationRow(integration);
}

export async function refreshShiprocketIntegration(
  supabase: SupabaseClient,
  sellerUserId: string
): Promise<Record<string, unknown>> {
  const existing = await getIntegration(supabase, sellerUserId, 'shiprocket');
  if (!existing) {
    throw new Error('Integration not connected');
  }

  const metadata = asMetadata(existing.metadata);
  if (metadata.isDemo) {
    throw new Error('Reconnect with your Shiprocket API credentials');
  }

  const email = metadata.apiUserEmail;
  const encPassword = metadata.encryptedPassword;
  if (!email || !encPassword) {
    throw new Error('Missing stored Shiprocket credentials — disconnect and reconnect');
  }

  const password = decryptSecret(encPassword);
  const auth = await shiprocketLogin(email, password);
  const locations = await fetchShiprocketPickupLocations(auth.token);
  const pickup = pickPrimaryPickup(locations);

  const integration = await upsertIntegration(
    supabase,
    sellerUserId,
    'shiprocket',
    {
      status: 'connected',
      account_id: existing.account_id != null ? String(existing.account_id) : null,
      metadata: {
        ...metadata,
        ...buildShiprocketMetadata(email, password, auth, pickup),
      },
      connected_at:
        existing.connected_at != null ? String(existing.connected_at) : new Date().toISOString(),
    }
  );

  return sanitizeIntegrationRow(integration);
}

export async function ensureShiprocketToken(
  metadata: ShiprocketServerMetadata
): Promise<{ token: string; metadata: ShiprocketServerMetadata }> {
  if (metadata.isDemo) {
    throw new Error('Shiprocket is not connected');
  }

  const email = metadata.apiUserEmail;
  const encPassword = metadata.encryptedPassword;
  const encToken = metadata.encryptedAccessToken;
  if (!email || !encPassword || !encToken) {
    throw new Error('Shiprocket credentials missing — reconnect in Store → Integrations');
  }

  const expiresAt = metadata.tokenExpiresAt
    ? new Date(metadata.tokenExpiresAt).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt < Date.now() + 60 * 60 * 1000;

  if (!needsRefresh) {
    return { token: decryptSecret(encToken), metadata };
  }

  const password = decryptSecret(encPassword);
  const auth = await shiprocketLogin(email, password);
  const updated: ShiprocketServerMetadata = {
    ...metadata,
    encryptedAccessToken: encryptSecret(auth.token),
    tokenExpiresAt: auth.expiresAt,
    lastError: null,
  };
  return { token: auth.token, metadata: updated };
}

import {
  normalizeShippingAddress,
  type ShippingAddress,
} from './shippingAddressUtils.js';

export type OrderShippingAddress = ShippingAddress;

export type CatShareOrderRow = {
  id: string;
  seller_user_id: string;
  customer_name: string;
  customer_whatsapp?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice?: number;
    rowTotal?: number;
    productId?: string;
  }>;
  total_amount?: number;
  payment_method?: string;
  shipping_address?: OrderShippingAddress | null;
  created_at: string;
};

function normalizePhone(phone: string | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || '9999999999';
}

function mapPaymentMethod(method: string | undefined): 'COD' | 'Prepaid' {
  return method === 'cod' ? 'COD' : 'Prepaid';
}

export async function createShiprocketShipmentForOrder(
  supabase: SupabaseClient,
  sellerUserId: string,
  orderId: string,
  shippingAddressOverride?: OrderShippingAddress | null
): Promise<Record<string, unknown>> {
  const integrationRow = await getIntegration(supabase, sellerUserId, 'shiprocket');
  if (!integrationRow || integrationRow.status !== 'connected') {
    throw new Error('Connect Shiprocket in Store → Integrations first');
  }

  let metadata = asMetadata(integrationRow.metadata);
  if (metadata.isDemo) {
    throw new Error('Reconnect Shiprocket with your API user credentials');
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('seller_user_id', sellerUserId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) throw new Error('Order not found');

  const orderRow = order as CatShareOrderRow;
  const existingAddress = normalizeShippingAddress(orderRow.shipping_address);
  const overrideAddress = normalizeShippingAddress(shippingAddressOverride);
  const address = overrideAddress ?? existingAddress;

  if (!address) {
    throw new Error(
      'Add a delivery address (street, city, state, and 6-digit pincode) before creating an AWB'
    );
  }

  if (overrideAddress && !existingAddress) {
    const { error: addrErr } = await supabase
      .from('orders')
      .update({
        shipping_address: overrideAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('seller_user_id', sellerUserId);
    if (addrErr) throw addrErr;
  }

  const pickupName =
    metadata.pickupLocationName ?? metadata.warehouseName ?? 'Primary';
  if (!pickupName) {
    throw new Error('No Shiprocket pickup location — refresh integration status');
  }

  const tokenResult = await ensureShiprocketToken(metadata);
  metadata = tokenResult.metadata;

  const items = Array.isArray(orderRow.items) ? orderRow.items : [];
  if (!items.length) {
    throw new Error('Order has no items');
  }

  const subTotal =
    orderRow.total_amount ??
    items.reduce((sum, item) => {
      const qty = Number(item.quantity ?? 1);
      const rowTotal = Number(item.rowTotal ?? 0);
      if (rowTotal > 0) return sum + rowTotal;
      return sum + Number(item.unitPrice ?? 0) * qty;
    }, 0);

  const shiprocketOrderId = `CS-${orderRow.id.replace(/-/g, '').slice(0, 20)}`;
  const orderDate = new Date(orderRow.created_at).toISOString().slice(0, 10);

  let createResult;
  try {
    createResult = await createShiprocketAdhocOrder(tokenResult.token, {
      orderId: shiprocketOrderId,
      orderDate,
      pickupLocation: pickupName,
      customerName: orderRow.customer_name,
      customerPhone: normalizePhone(orderRow.customer_whatsapp),
      billingAddress: [address.line1, address.line2].filter(Boolean).join(', '),
      billingCity: address.city,
      billingState: address.state,
      billingPincode: address.pincode,
      billingCountry: address.country ?? 'India',
      paymentMethod: mapPaymentMethod(orderRow.payment_method),
      subTotal: Number(subTotal) || 0,
      items: items.map((item, idx) => ({
        name: String(item.name ?? 'Item'),
        sku: String(item.productId ?? `item-${idx + 1}`).slice(0, 50),
        units: Number(item.quantity ?? 1),
        sellingPrice: Number(item.unitPrice ?? item.rowTotal ?? 0),
      })),
    });
  } catch (e) {
    const msg =
      e instanceof ShiprocketApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Could not create Shiprocket order';
    await upsertIntegration(supabase, sellerUserId, 'shiprocket', {
      status: 'error',
      account_id:
        integrationRow.account_id != null ? String(integrationRow.account_id) : null,
      metadata: { ...metadata, lastError: msg },
      connected_at:
        integrationRow.connected_at != null
          ? String(integrationRow.connected_at)
          : null,
    });
    throw new Error(msg);
  }

  let awbResult;
  try {
    awbResult = await assignShiprocketAwb(
      tokenResult.token,
      createResult.shipmentId
    );
  } catch (e) {
    const msg =
      e instanceof ShiprocketApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'AWB assignment failed';
    throw new Error(msg);
  }

  await upsertIntegration(supabase, sellerUserId, 'shiprocket', {
    status: 'connected',
    account_id:
      integrationRow.account_id != null ? String(integrationRow.account_id) : null,
    metadata,
    connected_at:
      integrationRow.connected_at != null ? String(integrationRow.connected_at) : null,
  });

  const now = new Date().toISOString();
  const timeline = [
    { id: 'created', label: 'Shipment Created', status: 'done', at: now },
    { id: 'pickup_scheduled', label: 'Pickup Scheduled', status: 'pending', at: null },
    { id: 'picked_up', label: 'Picked Up', status: 'pending', at: null },
    { id: 'in_transit', label: 'In Transit', status: 'pending', at: null },
    { id: 'reached_hub', label: 'Reached Hub', status: 'pending', at: null },
    { id: 'out_for_delivery', label: 'Out For Delivery', status: 'pending', at: null },
    { id: 'delivered', label: 'Delivered', status: 'pending', at: null },
  ];

  const shipmentRow = {
    order_id: orderId,
    seller_user_id: sellerUserId,
    provider: 'shiprocket' satisfies IntegrationProviderId,
    shipment_id: String(createResult.shipmentId),
    awb_number: awbResult.awbCode,
    courier: awbResult.courierName,
    tracking_number: awbResult.awbCode,
    tracking_url: awbResult.trackingUrl,
    delivery_status: awbResult.awbCode ? 'created' : 'unknown',
    timeline,
    last_updated_at: now,
    metadata: {
      shiprocketOrderId: createResult.orderId,
      catshareOrderRef: shiprocketOrderId,
    },
    updated_at: now,
  };

  const { data: saved, error: shipErr } = await supabase
    .from('order_shipments')
    .upsert(shipmentRow, { onConflict: 'order_id' })
    .select()
    .single();

  if (shipErr) throw shipErr;
  return saved as Record<string, unknown>;
}
