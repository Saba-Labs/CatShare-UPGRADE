import type { PaymentProvider } from '../../base/PaymentProvider';
import type {
  ConnectIntegrationResult,
  IntegrationConnectionStatus,
  SellerIntegration,
  SellerIntegrationView,
} from '../../../core/types';
import {
  apiConnectIntegration,
  apiDisconnectIntegration,
  apiRefreshIntegration,
} from '../../../services/integrationsApi';
import { mapRowToSellerIntegration } from '../../../services/sellerIntegrationsService';
import { RAZORPAY_GUIDE_STEPS, RAZORPAY_SECURITY_NOTE } from './razorpay.guide';
import type { RazorpayIntegrationMetadata } from './razorpay.types';
import type { PaymentAccountDetails } from '../../base/PaymentProvider';

function meta(row: SellerIntegration): RazorpayIntegrationMetadata {
  return (row.metadata ?? {}) as RazorpayIntegrationMetadata;
}

function formatDisplayStatus(status: IntegrationConnectionStatus): string {
  switch (status) {
    case 'not_connected':
      return 'Not Connected';
    case 'pending_verification':
      return 'Pending Verification';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

export const razorpayProvider: PaymentProvider = {
  id: 'razorpay',
  category: 'payments',
  displayName: 'Razorpay',
  description: 'Accept UPI, cards, and net banking. Payments go directly to your Razorpay account.',
  iconKey: 'razorpay',

  getGuideSteps: () => RAZORPAY_GUIDE_STEPS,
  getSecurityNote: () => RAZORPAY_SECURITY_NOTE,

  normalizeConnection(row: SellerIntegration): SellerIntegrationView {
    const m = meta(row);
    const details = this.getAccountDetails(row);
    const detailFields = [
      { label: 'Account Name', value: details.accountName },
      { label: 'Business Name', value: details.businessName },
      { label: 'Email', value: details.email },
      { label: 'Phone', value: details.phone },
      { label: 'Key ID', value: details.merchantId, mono: true },
      { label: 'Connection Date', value: details.connectionDate },
      { label: 'Account Status', value: details.accountStatus },
    ].filter((f) => f.value) as SellerIntegrationView['details'];

    const isDemo = Boolean(m.isDemo);
    return {
      id: row.id,
      provider: 'razorpay',
      category: 'payments',
      status: row.status,
      accountId: row.accountId,
      displayStatus: isDemo ? 'Demo mode' : formatDisplayStatus(row.status),
      connectedAt: row.connectedAt,
      updatedAt: row.updatedAt,
      lastError: m.lastError ?? null,
      isDemo,
      details: detailFields,
    };
  },

  getAccountDetails(connection: SellerIntegration): PaymentAccountDetails {
    const m = meta(connection);
    return {
      accountName: m.accountName ?? null,
      businessName: m.businessName ?? null,
      email: m.email ?? null,
      phone: m.phone ?? null,
      merchantId: m.keyIdMasked ?? m.merchantId ?? connection.accountId ?? null,
      accountStatus: m.accountStatus ?? null,
      connectionDate: m.connectionDate ?? connection.connectedAt ?? null,
    };
  },

  async connect(
    sellerId: string,
    options?: import('../../../core/types').IntegrationConnectOptions
  ): Promise<ConnectIntegrationResult> {
    const res = await apiConnectIntegration(sellerId, 'razorpay', options);
    if (res.error || !res.data) {
      throw new Error(
        typeof res.error === 'string' ? res.error : 'Could not connect Razorpay'
      );
    }
    const row = mapRowToSellerIntegration(res.data);
    return {
      connection: razorpayProvider.normalizeConnection(row),
      oauthUrl: res.oauthUrl ?? null,
    };
  },

  async disconnect(sellerId: string): Promise<void> {
    const res = await apiDisconnectIntegration(sellerId, 'razorpay');
    if (res.error) {
      throw new Error(
        typeof res.error === 'string' ? res.error : 'Could not disconnect Razorpay'
      );
    }
  },

  async refreshStatus(sellerId: string): Promise<SellerIntegrationView> {
    const res = await apiRefreshIntegration(sellerId, 'razorpay');
    if (res.error || !res.data) {
      throw new Error(
        typeof res.error === 'string' ? res.error : 'Could not refresh Razorpay status'
      );
    }
    return razorpayProvider.normalizeConnection(mapRowToSellerIntegration(res.data));
  },
};
