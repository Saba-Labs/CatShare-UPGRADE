import type { IntegrationProviderId } from '../../../integrations/core/types';

export type PaymentGatewayId =
  | 'razorpay'
  | 'stripe'
  | 'cashfree'
  | 'payu'
  | 'phonepe'
  | 'manual';

export interface PaymentGatewayLogo {
  initials: string;
  background: string;
  color: string;
}

export interface PaymentGatewayDefinition {
  id: PaymentGatewayId;
  name: string;
  description: string;
  logo: PaymentGatewayLogo;
  /** When true, gateway can be connected and managed. */
  available: boolean;
  /** Links to live integration provider when available. */
  integrationProviderId?: IntegrationProviderId;
  /** Detail / connect route for available gateways. */
  managePath?: string;
}

export const PAYMENT_GATEWAYS: PaymentGatewayDefinition[] = [
  {
    id: 'razorpay',
    name: 'Razorpay',
    description:
      'Accept UPI, cards, and net banking. Payments settle directly to your Razorpay account.',
    logo: { initials: 'RZ', background: '#0C2451', color: '#FFFFFF' },
    available: true,
    integrationProviderId: 'razorpay',
    managePath: '/store/integrations/razorpay',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept global card payments with Stripe Checkout and Payment Links.',
    logo: { initials: 'S', background: '#635BFF', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'cashfree',
    name: 'Cashfree',
    description: 'Enable UPI, cards, and wallets with Cashfree Payments.',
    logo: { initials: 'CF', background: '#00C48C', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'payu',
    name: 'PayU',
    description: 'Collect payments across India with PayU payment gateway.',
    logo: { initials: 'PU', background: '#A6C307', color: '#1A1A1A' },
    available: false,
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    description: 'Offer PhonePe and UPI checkout for fast mobile payments.',
    logo: { initials: 'Pe', background: '#5F259F', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'manual',
    name: 'Manual Payments',
    description: 'Accept bank transfer, UPI, or cash and confirm orders manually.',
    logo: { initials: 'MN', background: '#475569', color: '#FFFFFF' },
    available: false,
  },
];

export function getPaymentGateway(id: PaymentGatewayId): PaymentGatewayDefinition | undefined {
  return PAYMENT_GATEWAYS.find((gateway) => gateway.id === id);
}

export function getActivePaymentGateways(): PaymentGatewayDefinition[] {
  return PAYMENT_GATEWAYS.filter((gateway) => gateway.available);
}
