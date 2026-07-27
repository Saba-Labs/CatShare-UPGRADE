import { useCallback, useState } from 'react';
import type { Order } from '../../services/orderService';
import { getSymbolForCurrencyCode } from '../../utils/currencyUtils';
import CheckoutBreakdown from '../../components/Storefront/CheckoutBreakdown';
import { useOrderPayment } from '../hooks/useOrderPayment';
import { confirmUpiPaymentReceived, reverseUpiPaymentConfirmation } from '../services/orderPaymentsService';
import type { OrderPayment } from '../core/types';
import { resolveOrderPaymentDisplayAmount } from '../../utils/resolveOrderTotals';
import {
  OdCard,
  OdFooterNote,
  OdMethodChip,
  OdSectionLabel,
  OdStatusPill,
  getOrderPaymentStatusPill,
} from './orderDetailUi';

function formatMoney(amount: number | null | undefined, currency: string): string {
  const sym = getSymbolForCurrencyCode(currency);
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } catch {
    return iso;
  }
}

function formatPaymentMethod(method: string | null | undefined): string | null {
  if (!method) return null;
  if (method === 'prepaid') return 'Pay online / UPI';
  if (method === 'cod') return 'Cash on delivery';
  if (method === 'upi') return 'Pay via UPI (seller verifies)';
  if (method === 'manual') return 'Manual — seller handles payment';
  return method;
}

function paymentHeroTone(
  status: string,
  paymentMethod?: string | null
): 'paid' | 'pending' | 'failed' | 'cod' | 'refunded' {
  if (status === 'paid') return 'paid';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  if (status === 'refunded') return 'refunded';
  if (paymentMethod === 'cod') return 'cod';
  return 'pending';
}

function getPaymentConfirmedBy(payment: OrderPayment | null | undefined): 'customer' | 'seller' | null {
  const raw = payment?.metadata?.payment_confirmed_by;
  return raw === 'customer' || raw === 'seller' ? raw : null;
}

function getCustomerClaimedPaidAt(payment: OrderPayment | null | undefined): string | null {
  const raw = payment?.metadata?.customer_claimed_paid_at;
  return typeof raw === 'string' ? raw : null;
}

function PaymentHeroIcon({ tone }: { tone: ReturnType<typeof paymentHeroTone> }) {
  if (tone === 'paid') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
        <path
          d="M7 12.5l3 3 7-7.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === 'failed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
      <rect x="6" y="8" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11h12" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PaymentField({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }, [value]);

  if (!value || value === '—') return null;

  return (
    <div className="od-pay-field">
      <span className="od-pay-field-label">{label}</span>
      <div className="od-pay-field-body">
        <span className={`od-pay-field-value${mono ? ' od-pay-field-value--mono' : ''}`}>{value}</span>
        {copyable ? (
          <button type="button" className="od-pay-copy" onClick={() => void handleCopy()} aria-label={`Copy ${label}`}>
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function OrderPaymentSection({ order }: { order: Order }) {
  const { payment, loading, reload } = useOrderPayment(order.id);
  const [confirming, setConfirming] = useState(false);
  const [reversing, setReversing] = useState(false);
  const currency = order.currency_code || 'INR';
  const hasLegacy = order.payment_method != null || order.checkout_adjustments != null;

  const handleConfirmUpi = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    const res = await confirmUpiPaymentReceived(order.seller_user_id, order, payment);
    if (res.error) {
      console.error('Confirm UPI payment failed:', res.error);
      alert('Could not confirm payment. Please try again.');
    } else {
      await reload();
    }
    setConfirming(false);
  }, [confirming, order, payment, reload]);

  const handleReverseUpi = useCallback(async () => {
    if (reversing || !payment) return;
    const ok = window.confirm(
      'Undo payment confirmation? The order will show as awaiting UPI payment again until you confirm it.'
    );
    if (!ok) return;

    setReversing(true);
    const res = await reverseUpiPaymentConfirmation(order.seller_user_id, order, payment);
    if (res.error) {
      console.error('Reverse UPI payment failed:', res.error);
      alert('Could not undo payment confirmation. Please try again.');
    } else {
      await reload();
    }
    setReversing(false);
  }, [reversing, order, payment, reload]);

  if (loading && !payment && !hasLegacy) return null;
  if (!payment && !hasLegacy) return null;

  const paymentStatus = payment?.status ?? 'pending';
  const paymentMethod = payment?.paymentMethod ?? order.payment_method ?? null;
  const isUpi = paymentMethod === 'upi' || payment?.provider === 'upi';
  const customerClaimedAt = getCustomerClaimedPaidAt(payment);
  const paymentConfirmedBy = getPaymentConfirmedBy(payment);
  const pill = getOrderPaymentStatusPill(
    paymentStatus,
    paymentMethod,
    customerClaimedAt,
    paymentConfirmedBy
  );
  const heroTone = paymentHeroTone(paymentStatus, paymentMethod);
  const amountStr = formatMoney(
    resolveOrderPaymentDisplayAmount(order, payment),
    payment?.currency ?? currency
  );

  const isRazorpay = payment?.provider === 'razorpay';
  const isPaid = paymentStatus === 'paid';

  let heroTitle = 'Checkout payment';
  let heroSubtitle = 'Payment details from storefront checkout';

  if (isPaid && isUpi) {
    heroTitle =
      paymentConfirmedBy === 'customer' ? 'Customer reported payment' : 'UPI payment received';
    heroSubtitle = formatDateTime(payment?.paidAt);
  } else if (isPaid && payment) {
    heroTitle = 'Online payment received';
    heroSubtitle = formatDateTime(payment.paidAt);
  } else if (isUpi && customerClaimedAt && !isPaid) {
    heroTitle = 'Verify UPI payment';
    heroSubtitle = `Customer marked paid ${formatDateTime(customerClaimedAt)} — check your UPI app before fulfilling`;
  } else if (order.payment_method === 'cod') {
    heroSubtitle = 'Collect payment when you deliver';
  }

  const showWebhookNote = payment && isRazorpay && (paymentStatus === 'pending' || paymentStatus === 'failed');
  const showConfirmUpi =
    isUpi && (paymentStatus === 'pending' || (isPaid && paymentConfirmedBy === 'customer'));
  const showReverseUpi = isUpi && isPaid && payment?.provider === 'upi';

  return (
    <>
      <OdSectionLabel>Payment</OdSectionLabel>
      <OdCard className="od-card--payment">
        <div className={`od-pay-hero od-pay-hero--${heroTone}`}>
          <div className="od-pay-hero-glow" aria-hidden />
          <div className="od-pay-hero-inner">
            <div className="od-pay-hero-icon-wrap">
              <PaymentHeroIcon tone={heroTone} />
            </div>
            <div className="od-pay-hero-content">
              <div className="od-pay-hero-top">
                <OdStatusPill {...pill} kind="payment" />
                {payment ? (
                  <span className="od-pay-provider">{isUpi ? 'UPI' : isRazorpay ? 'Razorpay' : payment.provider}</span>
                ) : null}
              </div>
              {amountStr !== '—' ? <div className="od-pay-amount">{amountStr}</div> : null}
              <div className="od-pay-hero-title">{heroTitle}</div>
              <div className="od-pay-hero-sub">{heroSubtitle}</div>
            </div>
          </div>
        </div>

        {payment ? (
          <div className="od-pay-grid">
            {isUpi ? (
              <>
                <PaymentField label="Customer marked paid" value={formatDateTime(customerClaimedAt)} />
                <PaymentField label="Confirmed at" value={formatDateTime(payment.paidAt)} />
              </>
            ) : (
              <>
                <PaymentField label="Transaction ID" value={payment.paymentId} mono copyable />
                <PaymentField label="Gateway order" value={payment.providerOrderId} mono copyable />
                <PaymentField label="Paid at" value={formatDateTime(payment.paidAt)} />
              </>
            )}
            <PaymentField label="Method" value={formatPaymentMethod(payment.paymentMethod)} />
            <PaymentField label="Customer" value={payment.customerName} />
            {!isUpi ? <PaymentField label="Email" value={payment.customerEmail} /> : null}
            <PaymentField label="Phone" value={payment.customerPhone} />
          </div>
        ) : (
          <div className="od-pay-legacy">
            <div className="od-pay-legacy-method">
              <span className="od-pay-field-label">Payment method</span>
              <OdMethodChip method={order.payment_method} />
            </div>
            {order.checkout_adjustments ? (
              <div className="od-breakdown-wrap od-breakdown-wrap--modern">
                <CheckoutBreakdown
                  totals={order.checkout_adjustments}
                  currencySymbol={getSymbolForCurrencyCode(currency)}
                  fmt={(amount, sym) =>
                    `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                  }
                  compact
                />
              </div>
            ) : amountStr !== '—' ? (
              <div className="od-pay-field od-pay-field--full">
                <span className="od-pay-field-label">Amount</span>
                <span className="od-pay-field-value od-pay-field-value--amount">{amountStr}</span>
              </div>
            ) : null}
          </div>
        )}

        {showConfirmUpi ? (
          <button
            type="button"
            className="od-btn-primary od-pay-confirm-btn"
            onClick={() => void handleConfirmUpi()}
            disabled={confirming}
          >
            {confirming ? 'Confirming…' : 'Confirm payment received'}
          </button>
        ) : null}

        {showReverseUpi ? (
          <button
            type="button"
            className="od-btn-secondary od-pay-confirm-btn"
            onClick={() => void handleReverseUpi()}
            disabled={reversing}
          >
            {reversing ? 'Undoing…' : 'Undo payment confirmation'}
          </button>
        ) : null}

        {showWebhookNote ? (
          <OdFooterNote>
            Payment status updates automatically when Razorpay webhooks are connected.
          </OdFooterNote>
        ) : isUpi && !isPaid ? (
          <OdFooterNote>
            {customerClaimedAt
              ? 'UPI is not verified automatically. Confirm only after you see the payment in your UPI app.'
              : 'UPI is not verified automatically. The customer pays outside CatShare — confirm in your UPI app when money arrives.'}
          </OdFooterNote>
        ) : order.payment_method === 'manual' ? (
          <OdFooterNote>
            Payment is handled directly with the customer — confirm with them before fulfilling the order.
          </OdFooterNote>
        ) : null}
      </OdCard>
    </>
  );
}
