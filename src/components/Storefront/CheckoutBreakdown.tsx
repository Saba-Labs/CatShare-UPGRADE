import type { CheckoutTotals } from '../../types/checkoutSettings';

type Props = {
  totals: CheckoutTotals;
  currencySymbol: string;
  fmt: (amount: number, sym: string) => string;
  showBreakdown?: boolean;
  compact?: boolean;
};

export default function CheckoutBreakdown({
  totals,
  currencySymbol,
  fmt,
  showBreakdown = true,
  compact = false,
}: Props) {
  const hasAdjustments =
    totals.discountTotal > 0 ||
    totals.shippingTotal > 0 ||
    totals.taxTotal > 0 ||
    totals.lines.length > 0;

  if (!showBreakdown && !hasAdjustments) {
    return (
      <div className="sv-checkout-breakdown">
        <div className="sv-checkout-breakdown-row sv-checkout-breakdown-row--grand">
          <span>Total</span>
          <span>{fmt(totals.grandTotal, currencySymbol)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`sv-checkout-breakdown${compact ? ' is-compact' : ''}`}>
      <div className="sv-checkout-breakdown-row">
        <span>Subtotal</span>
        <span>{fmt(totals.subtotal, currencySymbol)}</span>
      </div>
      {showBreakdown &&
        totals.lines.map((line) => (
          <div key={line.ruleId + line.label} className="sv-checkout-breakdown-row">
            <span>{line.label}</span>
            <span className={line.amount < 0 ? 'is-discount' : ''}>
              {line.amount < 0 ? '−' : ''}
              {fmt(Math.abs(line.amount), currencySymbol)}
            </span>
          </div>
        ))}
      {!showBreakdown && totals.discountTotal > 0 ? (
        <div className="sv-checkout-breakdown-row">
          <span>Discount</span>
          <span className="is-discount">−{fmt(totals.discountTotal, currencySymbol)}</span>
        </div>
      ) : null}
      {!showBreakdown && totals.shippingTotal > 0 ? (
        <div className="sv-checkout-breakdown-row">
          <span>Shipping &amp; fees</span>
          <span>{fmt(totals.shippingTotal, currencySymbol)}</span>
        </div>
      ) : null}
      {!showBreakdown && totals.taxTotal > 0 ? (
        <div className="sv-checkout-breakdown-row">
          <span>Tax</span>
          <span>{fmt(totals.taxTotal, currencySymbol)}</span>
        </div>
      ) : null}
      {totals.freeShippingApplied ? (
        <div className="sv-checkout-breakdown-note">Free shipping applied</div>
      ) : null}
      {totals.appliedCouponCode ? (
        <div className="sv-checkout-breakdown-note">Coupon {totals.appliedCouponCode} applied</div>
      ) : null}
      <div className="sv-checkout-breakdown-row sv-checkout-breakdown-row--grand">
        <span>Total</span>
        <span>{fmt(totals.grandTotal, currencySymbol)}</span>
      </div>
    </div>
  );
}
