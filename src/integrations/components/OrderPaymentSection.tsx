import type { Order } from '../../services/orderService';
import { getSymbolForCurrencyCode } from '../../utils/currencyUtils';
import CheckoutBreakdown from '../../components/Storefront/CheckoutBreakdown';
import { useOrderPayment } from '../hooks/useOrderPayment';
import {
  OdCard,
  OdCardHeader,
  OdDetailRow,
  OdFooterNote,
  OdIcons,
  OdSectionLabel,
  OdStatusPill,
  getPaymentStatusPill,
  OD_COLORS,
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

const paymentMethodLabel = (method: string | null | undefined) => {
  if (!method) return '—';
  if (method === 'cod') return 'Cash on delivery';
  if (method === 'prepaid') return 'Pay now / UPI';
  return method;
};

export function OrderPaymentSection({ order }: { order: Order }) {
  const { payment, loading } = useOrderPayment(order.id);
  const currency = order.currency_code || 'INR';
  const hasLegacy = order.payment_method != null || order.checkout_adjustments != null;

  if (loading && !payment && !hasLegacy) return null;
  if (!payment && !hasLegacy) return null;

  const pill = getPaymentStatusPill(
    payment?.status ?? (order.payment_method === 'cod' ? 'pending' : 'paid')
  );
  const amountStr = payment
    ? formatMoney(payment.amount, payment.currency)
    : formatMoney(order.checkout_adjustments?.grandTotal ?? order.total_amount ?? null, currency);

  return (
    <>
      <OdSectionLabel>Payment</OdSectionLabel>
      <OdCard>
        <OdCardHeader
          icon={<OdIcons.Payment />}
          title={payment ? 'Gateway payment' : 'Checkout payment'}
          subtitle={amountStr !== '—' ? amountStr : undefined}
          accentColor={OD_COLORS.green}
          badge={<OdStatusPill {...pill} />}
        />

        {payment ? (
          <>
            <OdDetailRow label="Transaction ID" value={payment.paymentId} mono />
            <OdDetailRow label="Order ID" value={payment.providerOrderId} mono />
            <OdDetailRow label="Paid at" value={formatDateTime(payment.paidAt)} />
            <OdDetailRow label="Method" value={payment.paymentMethod} />
            <OdDetailRow label="Amount" value={amountStr} highlight />
            <OdDetailRow label="Customer" value={payment.customerName} />
            <OdDetailRow label="Email" value={payment.customerEmail} />
            <OdDetailRow label="Phone" value={payment.customerPhone} isLast />
          </>
        ) : (
          <>
            <OdDetailRow label="Method" value={paymentMethodLabel(order.payment_method)} />
            {order.checkout_adjustments ? (
              <div
                style={{
                  padding: '8px 16px 12px',
                  borderTop: `1px solid ${OD_COLORS.divider}`,
                }}
              >
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

        <OdFooterNote>
          Payment status will update automatically when Razorpay webhooks are connected.
        </OdFooterNote>
      </OdCard>
    </>
  );
}
