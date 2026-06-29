import type { ShippingProvider } from '../../base/ShippingProvider';
import type {
  ConnectIntegrationResult,
  DeliveryStatus,
  IntegrationConnectionStatus,
  IntegrationConnectOptions,
  IntegrationDetailField,
  IntegrationDetailSection,
  OrderShipment,
  SellerIntegration,
  SellerIntegrationView,
  ShipmentTimelineEvent,
} from '../../../core/types';
import {
  apiConnectIntegration,
  apiCancelOrderShipment,
  apiCreateOrderShipment,
  apiDisconnectIntegration,
  apiRefreshIntegration,
} from '../../../services/integrationsApi';
import { mapRowToSellerIntegration } from '../../../services/sellerIntegrationsService';
import { SHIPROCKET_GUIDE_STEPS, SHIPROCKET_SECURITY_NOTE } from './shiprocket.guide';
import type { ShiprocketIntegrationMetadata } from './shiprocket.types';
import type { ShippingPickupDetails } from '../../base/ShippingProvider';

function meta(row: SellerIntegration): ShiprocketIntegrationMetadata {
  return (row.metadata ?? {}) as ShiprocketIntegrationMetadata;
}

function formatIntegrationDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDisplayStatus(status: IntegrationConnectionStatus): string {
  switch (status) {
    case 'not_connected':
      return 'Not Connected';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Error';
    case 'pending_verification':
      return 'Pending';
    default:
      return 'Unknown';
  }
}

function detailField(
  label: string,
  value: string | null | undefined,
  mono = false
): IntegrationDetailField | null {
  if (!value?.trim()) return null;
  return { label, value: value.trim(), mono };
}

function buildDetailSections(
  row: SellerIntegration,
  m: ShiprocketIntegrationMetadata,
  isDemo: boolean
): IntegrationDetailSection[] {
  const connectionFields = [
    detailField('Status', isDemo ? 'Demo mode' : formatDisplayStatus(row.status)),
    detailField('API user', m.apiUserEmailMasked),
    detailField(
      'Company ID',
      m.companyId != null ? String(m.companyId) : row.accountId,
      true
    ),
    detailField('Connected', formatIntegrationDate(m.connectionDate ?? row.connectedAt)),
    detailField(
      'Last checked',
      formatIntegrationDate(m.lastVerifiedAt ?? row.updatedAt)
    ),
    detailField('Token expires', formatIntegrationDate(m.tokenExpiresAt)),
  ].filter((f): f is IntegrationDetailField => f != null);

  const pickupFields = [
    detailField('Warehouse', m.warehouseName ?? m.pickupLocationName),
    detailField('Pickup location', m.pickupLocationName),
    detailField('Pickup address', m.pickupAddress),
  ].filter((f): f is IntegrationDetailField => f != null);

  const catshareFields: IntegrationDetailField[] = [
    { label: 'Shipping mode', value: 'Enable Provider in Store → Shipping' },
    { label: 'Checkout', value: 'Collects delivery address when provider mode is on' },
    { label: 'Orders', value: 'Create AWB from order shipment section' },
    { label: 'Tracking', value: 'Live status, AWB, and courier tracking link' },
    { label: 'Manage', value: 'Cancel shipment and create a new AWB if needed' },
  ];

  const sections: IntegrationDetailSection[] = [
    { title: 'Connection', fields: connectionFields },
  ];

  if (pickupFields.length > 0) {
    sections.push({ title: 'Pickup & warehouse', fields: pickupFields });
  }

  sections.push({ title: 'In CatShare', fields: catshareFields });

  return sections;
}

export const shiprocketProvider: ShippingProvider = {
  id: 'shiprocket',
  category: 'shipping',
  displayName: 'Shiprocket',
  description: 'Ship orders with Shiprocket. Create AWBs and track deliveries from CatShare.',
  iconKey: 'shiprocket',

  getGuideSteps: () => SHIPROCKET_GUIDE_STEPS,
  getSecurityNote: () => SHIPROCKET_SECURITY_NOTE,

  normalizeConnection(row: SellerIntegration): SellerIntegrationView {
    const m = meta(row);
    const isDemo = Boolean(m.isDemo);
    const detailSections = buildDetailSections(row, m, isDemo);
    const details = detailSections.flatMap((section) => section.fields);

    return {
      id: row.id,
      provider: 'shiprocket',
      category: 'shipping',
      status: row.status,
      accountId: row.accountId,
      displayStatus: isDemo ? 'Demo mode' : formatDisplayStatus(row.status),
      connectedAt: row.connectedAt,
      updatedAt: row.updatedAt,
      lastError: m.lastError ?? null,
      isDemo,
      details,
      detailSections,
    };
  },

  getPickupDetails(connection: SellerIntegration): ShippingPickupDetails {
    const m = meta(connection);
    return {
      warehouseName: m.warehouseName ?? null,
      pickupAddress: m.pickupAddress ?? null,
      connectedDate:
        formatIntegrationDate(m.connectionDate ?? connection.connectedAt) ?? null,
      status: formatDisplayStatus(connection.status),
    };
  },

  async connect(
    sellerId: string,
    options?: IntegrationConnectOptions
  ): Promise<ConnectIntegrationResult> {
    const res = await apiConnectIntegration(sellerId, 'shiprocket', options);
    if (res.error || !res.data) {
      throw new Error(
        typeof res.error === 'string' ? res.error : 'Could not connect Shiprocket'
      );
    }
    const row = mapRowToSellerIntegration(res.data);
    return {
      connection: shiprocketProvider.normalizeConnection(row),
      oauthUrl: res.oauthUrl ?? null,
    };
  },

  async disconnect(sellerId: string): Promise<void> {
    const res = await apiDisconnectIntegration(sellerId, 'shiprocket');
    if (res.error) {
      throw new Error(
        typeof res.error === 'string' ? res.error : 'Could not disconnect Shiprocket'
      );
    }
  },

  async refreshStatus(sellerId: string): Promise<SellerIntegrationView> {
    const res = await apiRefreshIntegration(sellerId, 'shiprocket');
    if (res.error || !res.data) {
      throw new Error(
        typeof res.error === 'string' ? res.error : 'Could not refresh Shiprocket status'
      );
    }
    return shiprocketProvider.normalizeConnection(mapRowToSellerIntegration(res.data));
  },

  async createShipment(
    sellerId: string,
    orderId: string,
    shippingAddress?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
      country?: string;
    } | null
  ): Promise<OrderShipment> {
    const res = await apiCreateOrderShipment(orderId, shippingAddress ?? undefined);
    if (res.error || !res.data) {
      throw new Error(res.error ?? 'Could not create shipment');
    }
    const row = res.data;
    return {
      id: String(row.id ?? ''),
      orderId: String(row.order_id ?? orderId),
      sellerUserId: String(row.seller_user_id ?? sellerId),
      provider: 'shiprocket',
      shipmentId: row.shipment_id != null ? String(row.shipment_id) : null,
      awbNumber: row.awb_number != null ? String(row.awb_number) : null,
      courier: row.courier != null ? String(row.courier) : null,
      trackingNumber:
        row.tracking_number != null ? String(row.tracking_number) : null,
      trackingUrl: row.tracking_url != null ? String(row.tracking_url) : null,
      pickupDate: null,
      estimatedDelivery: null,
      deliveryStatus: String(row.delivery_status ?? 'created') as DeliveryStatus,
      timeline: Array.isArray(row.timeline)
        ? (row.timeline as ShipmentTimelineEvent[])
        : [],
      lastUpdatedAt: row.last_updated_at != null ? String(row.last_updated_at) : null,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {},
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  },

  async cancelShipment(sellerId: string, orderId: string): Promise<OrderShipment> {
    const res = await apiCancelOrderShipment(orderId);
    if (res.error || !res.data) {
      throw new Error(res.error ?? 'Could not cancel shipment');
    }
    const row = res.data;
    return {
      id: String(row.id ?? ''),
      orderId: String(row.order_id ?? orderId),
      sellerUserId: String(row.seller_user_id ?? sellerId),
      provider: 'shiprocket',
      shipmentId: row.shipment_id != null ? String(row.shipment_id) : null,
      awbNumber: row.awb_number != null ? String(row.awb_number) : null,
      courier: row.courier != null ? String(row.courier) : null,
      trackingNumber:
        row.tracking_number != null ? String(row.tracking_number) : null,
      trackingUrl: row.tracking_url != null ? String(row.tracking_url) : null,
      pickupDate: row.pickup_date != null ? String(row.pickup_date) : null,
      estimatedDelivery:
        row.estimated_delivery != null ? String(row.estimated_delivery) : null,
      deliveryStatus: String(row.delivery_status ?? 'cancelled') as DeliveryStatus,
      timeline: Array.isArray(row.timeline)
        ? (row.timeline as ShipmentTimelineEvent[])
        : [],
      lastUpdatedAt: row.last_updated_at != null ? String(row.last_updated_at) : null,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {},
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  },
};
