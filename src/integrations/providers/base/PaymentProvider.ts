import type { IntegrationProvider } from './IntegrationProvider';
import type { OrderPayment, SellerIntegration } from '../../core/types';

export interface PaymentAccountDetails {
  accountName: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  merchantId: string | null;
  accountStatus: string | null;
  connectionDate: string | null;
}

export interface PaymentProvider extends IntegrationProvider {
  getAccountDetails(connection: SellerIntegration): PaymentAccountDetails;

  /** Future: create Razorpay order / payment link */
  createPayment?(
    sellerId: string,
    orderId: string,
    amount: number,
    currency: string
  ): Promise<{ paymentId: string; providerOrderId: string }>;

  /** Future: process webhook and return updated payment */
  handleWebhook?(event: unknown): Promise<OrderPayment | null>;
}
