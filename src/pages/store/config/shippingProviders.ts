import type { IntegrationProviderId } from '../../../integrations/core/types';

export type ShippingProviderId =
  | 'shiprocket'
  | 'delhivery'
  | 'bluedart'
  | 'dtdc';

export interface ShippingProviderLogo {
  initials: string;
  background: string;
  color: string;
}

export interface ShippingProviderDefinition {
  id: ShippingProviderId;
  name: string;
  description: string;
  logo: ShippingProviderLogo;
  available: boolean;
  integrationProviderId?: IntegrationProviderId;
  managePath?: string;
}

export const SHIPPING_PROVIDERS: ShippingProviderDefinition[] = [
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    description:
      'Automate shipping, pickups, and tracking with India’s leading logistics aggregator.',
    logo: { initials: 'SR', background: '#6F2DBD', color: '#FFFFFF' },
    available: true,
    integrationProviderId: 'shiprocket',
    managePath: '/store/integrations/shiprocket',
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    description: 'Nationwide express delivery with real-time tracking and COD support.',
    logo: { initials: 'DL', background: '#E31E24', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'bluedart',
    name: 'Blue Dart',
    description: 'Premium express logistics for fast and reliable domestic shipping.',
    logo: { initials: 'BD', background: '#003DA5', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'dtdc',
    name: 'DTDC',
    description: 'Cost-effective parcel delivery across India with wide pincode coverage.',
    logo: { initials: 'DT', background: '#1B75BB', color: '#FFFFFF' },
    available: false,
  },
];

export function getShippingProvider(id: ShippingProviderId): ShippingProviderDefinition | undefined {
  return SHIPPING_PROVIDERS.find((provider) => provider.id === id);
}

export function getActiveShippingProviders(): ShippingProviderDefinition[] {
  return SHIPPING_PROVIDERS.filter((provider) => provider.available);
}
