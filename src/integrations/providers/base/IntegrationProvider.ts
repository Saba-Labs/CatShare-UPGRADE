import type {
  ConnectIntegrationResult,
  IntegrationGuideStep,
  IntegrationProviderId,
  IntegrationCategory,
  IntegrationSecurityNote,
  IntegrationConnectOptions,
  SellerIntegration,
  SellerIntegrationView,
} from '../../core/types';

export interface IntegrationProvider {
  readonly id: IntegrationProviderId;
  readonly category: IntegrationCategory;
  readonly displayName: string;
  readonly description: string;
  readonly iconKey: 'razorpay' | 'shiprocket';

  getGuideSteps(): IntegrationGuideStep[];
  getSecurityNote(): IntegrationSecurityNote;

  normalizeConnection(row: SellerIntegration): SellerIntegrationView;

  /** Connect via API (OAuth or provider-specific credentials) */
  connect(
    sellerId: string,
    options?: IntegrationConnectOptions
  ): Promise<ConnectIntegrationResult>;
  disconnect(sellerId: string): Promise<void>;
  refreshStatus(sellerId: string): Promise<SellerIntegrationView>;
}

export class NotImplementedIntegrationError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet.`);
    this.name = 'NotImplementedIntegrationError';
  }
}
