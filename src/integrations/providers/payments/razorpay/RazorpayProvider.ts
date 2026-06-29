import type { PaymentProvider } from '../../base/PaymentProvider';
import type {
  ConnectIntegrationResult,
  IntegrationConnectionStatus,
  IntegrationDetailField,
  IntegrationDetailSection,
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
  m: RazorpayIntegrationMetadata,
  isDemo: boolean
): IntegrationDetailSection[] {
  const keyModeLabel =
    m.keyMode === 'live' ? 'Live' : m.keyMode === 'test' ? 'Test' : null;

  const connectionFields = [
    detailField('Status', isDemo ? 'Demo mode' : formatDisplayStatus(row.status)),
    detailField('Key mode', keyModeLabel),
    detailField('Key ID', m.keyIdMasked ?? m.merchantId ?? row.accountId, true),
    detailField('Connected', formatIntegrationDate(m.connectionDate ?? row.connectedAt)),
    detailField(
      'Last checked',
      formatIntegrationDate(m.lastVerifiedAt ?? row.updatedAt)
    ),
  ].filter((f): f is IntegrationDetailField => f != null);

  const accountFields = [
    detailField('Account', m.accountName ?? m.businessName),
    detailField('Email', m.email),
    detailField('Phone', m.phone),
    detailField('Razorpay status', m.accountStatus),
  ].filter((f): f is IntegrationDetailField => f != null);

  const catshareFields: IntegrationDetailField[] = [
    { label: 'Store checkout', value: 'Online prepaid (when enabled in Payments)' },
    { label: 'Order links', value: 'Pay now at customer checkout' },
    { label: 'Payment methods', value: 'UPI, cards, net banking, wallets' },
    { label: 'Settlement', value: 'Payments go to your Razorpay account' },
  ];

  const sections: IntegrationDetailSection[] = [
    { title: 'Connection', fields: connectionFields },
  ];

  if (accountFields.length > 0) {
    sections.push({ title: 'Account', fields: accountFields });
  }

  sections.push({ title: 'In CatShare', fields: catshareFields });

  return sections;
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
    const isDemo = Boolean(m.isDemo);
    const detailSections = buildDetailSections(row, m, isDemo);
    const details = detailSections.flatMap((section) => section.fields);

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
      details,
      detailSections,
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
