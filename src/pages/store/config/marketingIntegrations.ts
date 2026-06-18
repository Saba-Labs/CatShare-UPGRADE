export type MarketingIntegrationId = 'google-ads' | 'meta-ads';

export interface MarketingIntegrationDefinition {
  id: MarketingIntegrationId;
  name: string;
  description: string;
  logo: { initials: string; background: string; color: string };
  available: boolean;
}

export const MARKETING_INTEGRATIONS: MarketingIntegrationDefinition[] = [
  {
    id: 'google-ads',
    name: 'Google Ads',
    description: 'Run search and display campaigns that drive traffic to your store.',
    logo: { initials: 'G', background: '#4285F4', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    description: 'Promote products on Facebook and Instagram with Meta advertising.',
    logo: { initials: 'M', background: '#1877F2', color: '#FFFFFF' },
    available: false,
  },
];

export function getActiveMarketingIntegrations(): MarketingIntegrationDefinition[] {
  return MARKETING_INTEGRATIONS.filter((integration) => integration.available);
}
