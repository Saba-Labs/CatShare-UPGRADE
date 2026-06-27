import type { Order } from '../../services/orderService';
import { getSymbolForCurrencyCode } from '../../utils/currencyUtils';
import CheckoutBreakdown from '../../components/Storefront/CheckoutBreakdown';
import { useOrderPayment } from '../hooks/useOrderPayment';
import {
  OdCard,
  OdCardHeader,
  OdDetailRow,
  OdFooterNote,
  OdHeroAmount,
  OdIcons,
  OdMethodChip,
  OdSectionLabel,
  OdStatusPill,
  getPaymentStatusPill,
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

export function OrderPaymentSection({ order }: { order: Order }) {
  const { payment, loading } = useOrderPayment(order.id);
  const currency = order.currency_code || 'INR';
  const hasLegacy = order.payment_method != null || order.checkout_adjustments != null;

  if (loading && !payment && !hasLegacy) return null;
  if (!payment && !hasLegacy) return null;

  const pill = getPaymentStatusPill(payment?.status ?? 'pending');
  const amountStr = payment
    ? formatMoney(payment.amount, payment.currency)
    : formatMoney(order.checkout_adjustments?.grandTotal ?? order.total_amount ?? null, currency);

  return (
    <>
      <OdSectionLabel>Payment</OdSectionLabel>
      <OdCard>
        <OdCardHeader
          variant="payment"
          icon={<OdIcons.Payment />}
          title={payment ? 'Gateway payment' : 'Checkout payment'}
          subtitle={payment ? 'Razorpay' : 'Order checkout'}
          badge={<OdStatusPill {...pill} />}
        />

        {amountStr !== '—' ? (
          <div style={{ padding: '16px 18px 4px' }}>
            <OdHeroAmount>{amountStr}</OdHeroAmount>
          </div>
        ) : null}

        <div className="od-detail-grid">
          {payment ? (
            <>
              <OdDetailRow label="Transaction ID" value={payment.paymentId} mono />
              <OdDetailRow label="Order ID" value={payment.providerOrderId} mono />
              <OdDetailRow label="Paid at" value={formatDateTime(payment.paidAt)} />
              <OdDetailRow label="Method" value={payment.paymentMethod} />
              <OdDetailRow label="Customer" value={payment.customerName} />
              <OdDetailRow label="Email" value={payment.customerEmail} />
              <OdDetailRow label="Phone" value={payment.customerPhone} isLast />
            </>
          ) : (
            <>
              <div className="od-detail-row">
                <span className="od-detail-label">Method</span>
                <span className="od-detail-value">
                  <OdMethodChip method={order.payment_method} />
                </span>
              </div>
              {order.checkout_adjustments ? (
                <div className="od-breakdown-wrap">
                  <CheckoutBreakdown
                    totals={order.checkout_adjustments}
                    currencySymbol={getSymbolForCurrencyCode(currency)}
                    fmt={(amount, sym) =>
                      `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                    }
                    compact
                  />
                </div>
              ) : (
                <OdDetailRow label="Amount" value={amountStr} highlight isLast />
              )}
            </>
          )}
        </div>

        <OdFooterNote>
          Payment status updates automatically when Razorpay webhooks are connected.
        </OdFooterNote>
      </OdCard>
    </>
  );
}
