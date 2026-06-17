/**
 * Shared types for the Integrations module.
 * Single source of truth for provider IDs, connection state, payments, and shipments.
 */

export type IntegrationProviderId = 'razorpay' | 'shiprocket';

export type IntegrationCategory = 'payments' | 'shipping' | 'marketing' | 'analytics';

export type IntegrationConnectionStatus =
  | 'not_connected'
  | 'pending_verification'
  | 'connected'
  | 'error';

export type RazorpayConnectionStatus =
  | 'not_connected'
  | 'pending_verification'
  | 'connected'
  | 'error';

export type ShiprocketConnectionStatus = 'not_connected' | 'connected' | 'error';

export interface IntegrationGuideStep {
  step: number;
  title: string;
  description?: string;
}

export interface IntegrationSecurityNote {
  title: string;
  points: string[];
}

export interface SellerIntegration {
  id: string;
  sellerUserId: string;
  provider: IntegrationProviderId;
  category: IntegrationCategory;
  status: IntegrationConnectionStatus;
  accountId: string | null;
  metadata: Record<string, unknown>;
  connectedAt: string | null;
  updatedAt: string;
  createdAt?: string;
}

/** UI-safe view — no secrets/tokens exposed */
export interface SellerIntegrationView {
  id: string;
  provider: IntegrationProviderId;
  category: IntegrationCategory;
  status: IntegrationConnectionStatus;
  accountId: string | null;
  displayStatus: string;
  connectedAt: string | null;
  updatedAt: string;
  lastError: string | null;
  /** MVP stub connection — not linked to a live provider account */
  isDemo?: boolean;
  details: IntegrationDetailField[];
}

export interface IntegrationDetailField {
  label: string;
  value: string;
  mono?: boolean;
}

export type OrderPaymentStatus =
  | 'paid'
  | 'failed'
  | 'pending'
  | 'refunded'
  | 'cancelled';

export interface OrderPayment {
  id: string;
  orderId: string;
  sellerUserId: string;
  provider: IntegrationProviderId | string;
  status: OrderPaymentStatus;
  paymentId: string | null;
  providerOrderId: string | null;
  amount: number | null;
  currency: string;
  paymentMethod: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  paidAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentTimelineEventStatus = 'done' | 'pending' | 'error';

export interface ShipmentTimelineEvent {
  id: string;
  label: string;
  status: ShipmentTimelineEventStatus;
  at?: string | null;
}

export type DeliveryStatus =
  | 'created'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'reached_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export interface OrderShipment {
  id: string;
  orderId: string;
  sellerUserId: string;
  provider: IntegrationProviderId | string;
  shipmentId: string | null;
  awbNumber: string | null;
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  pickupDate: string | null;
  estimatedDelivery: string | null;
  deliveryStatus: DeliveryStatus;
  timeline: ShipmentTimelineEvent[];
  lastUpdatedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ShippingPreferenceMode = 'actual' | 'free' | 'flat';

export interface ShippingPreferences {
  mode: ShippingPreferenceMode;
  flatAmount?: number;
  freeAboveAmount?: number;
}

export const DEFAULT_SHIPPING_PREFERENCES: ShippingPreferences = {
  mode: 'actual',
};

export interface WebhookEvent {
  provider: IntegrationProviderId;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface ConnectIntegrationResult {
  connection: SellerIntegrationView;
  oauthUrl?: string | null;
}

export type ShiprocketConnectCredentials = {
  email: string;
  password: string;
};

export type RazorpayConnectCredentials = {
  keyId: string;
  keySecret: string;
};

export type IntegrationConnectOptions = {
  razorpay?: RazorpayConnectCredentials;
  shiprocket?: ShiprocketConnectCredentials;
};

export interface OrderShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface IntegrationProviderMeta {
  id: IntegrationProviderId;
  category: IntegrationCategory;
  displayName: string;
  description: string;
  iconKey: 'razorpay' | 'shiprocket';
}
