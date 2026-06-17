import type { IntegrationCategory, IntegrationProviderId } from './types';
import type { IntegrationProvider } from '../providers/base/IntegrationProvider';
import { razorpayProvider } from '../providers/payments/razorpay/RazorpayProvider';
import { shiprocketProvider } from '../providers/shipping/shiprocket/ShiprocketProvider';

export const INTEGRATION_PROVIDERS = {
  razorpay: razorpayProvider,
  shiprocket: shiprocketProvider,
} as const satisfies Record<IntegrationProviderId, IntegrationProvider>;

export const INTEGRATION_PROVIDER_IDS = Object.keys(
  INTEGRATION_PROVIDERS
) as IntegrationProviderId[];

export function getProvider(id: IntegrationProviderId): IntegrationProvider {
  const provider = INTEGRATION_PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown integration provider: ${id}`);
  }
  return provider;
}

export function listProvidersByCategory(
  category: IntegrationCategory
): IntegrationProvider[] {
  return INTEGRATION_PROVIDER_IDS.map((id) => getProvider(id)).filter(
    (p) => p.category === category
  );
}

export function isIntegrationProviderId(id: string): id is IntegrationProviderId {
  return id in INTEGRATION_PROVIDERS;
}
