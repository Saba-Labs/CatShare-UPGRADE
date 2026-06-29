import type { RazorpayConnectionStatus } from '../../../core/types';

export interface RazorpayIntegrationMetadata {
  keyIdMasked?: string;
  keyMode?: 'test' | 'live';
  accountName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  merchantId?: string;
  accountStatus?: string;
  connectionDate?: string;
  lastVerifiedAt?: string;
  lastError?: string;
  isDemo?: boolean;
}

export function isRazorpayStatus(
  status: string
): status is RazorpayConnectionStatus {
  return (
    status === 'not_connected' ||
    status === 'pending_verification' ||
    status === 'connected' ||
    status === 'error'
  );
}
