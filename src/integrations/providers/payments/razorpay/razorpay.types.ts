import type { RazorpayConnectionStatus } from '../../../core/types';

export interface RazorpayIntegrationMetadata {
  accountName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  merchantId?: string;
  accountStatus?: string;
  connectionDate?: string;
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
