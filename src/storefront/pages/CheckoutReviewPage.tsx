import CheckoutBreakdown from '../../components/Storefront/CheckoutBreakdown';
import type { CheckoutTotals, StoreCheckoutSettings } from '../../types/checkoutSettings';
import { isDisplayableImageUrl, productImageDisplayUrl } from '../../utils/imageUrl';
import { CheckoutIconImg, CheckoutVariantPills } from '../components/CheckoutUi';
import type { CheckoutOrderLine } from './CheckoutDetailsPage';

interface CheckoutReviewPageProps {
  reviewItems: CheckoutOrderLine[];
  customerName: string;
  customerWhatsappCountry: string;
  customerWhatsappNumber: string;
  showGatewayPaymentChoice: boolean;
  showUpiPaymentChoice: boolean;
  showPrepaidOption: boolean;
  showUpiOption: boolean;
  showCodOption: boolean;
  isGatewayPaymentMode: boolean;
  isUpiPaymentMode: boolean;
  checkoutPaymentLabel: string;
  resolvedPaymentChoice: 'prepaid' | 'cod' | 'upi';
  checkoutTotals: CheckoutTotals;
  checkoutSettings: StoreCheckoutSettings;
  hasCheckoutRules: boolean;
  currencySymbol: string;
  fmt: (amount: number, symbol: string) => string;
  fmtCalc: (
    qty: number,
    unitPrice: number,
    priceUnit: string | undefined,
    symbol: string,
    step?: number
  ) => string | null;
  onEditItems: () => void;
  orderNote: string;
  giftMessage: string;
}

export default function CheckoutReviewPage({
  reviewItems,
  customerName,
  customerWhatsappCountry,
  customerWhatsappNumber,
  showGatewayPaymentChoice,
  showUpiPaymentChoice,
  showPrepaidOption,
  showUpiOption,
  showCodOption,
  isGatewayPaymentMode,
  isUpiPaymentMode,
  checkoutPaymentLabel,
  resolvedPaymentChoice,
  checkoutTotals,
  checkoutSettings,
  hasCheckoutRules,
  currencySymbol,
  fmt,
  fmtCalc,
  onEditItems,
  orderNote,
  giftMessage,
}: CheckoutReviewPageProps) {
  return (
    <div className="sv-checkout-content">
      <div className="sv-review-layout sv-checkout-grid sv-checkout-grid--review">
        <section className="sv-checkout-section sv-checkout-section--main">
          <div className="sv-review-list" style={{ padding: 0, margin: 0 }}>
            {reviewItems.map((item) => {
              const cd = fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol, item.quantityStep);
              return (
                <div key={item.productId} className="sv-rcard">
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      flexShrink: 0,
                      background: 'var(--c-surface2)',
                      overflow: 'hidden',
                      position: 'relative',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    {(() => {
                      const src = productImageDisplayUrl(item.imageUrl, item.imageVersion);
                      return isDisplayableImageUrl(src) ? (
                        <img
                          key={src}
                          src={src}
                          alt={item.name}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CheckoutIconImg size={24} />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="sv-rcard-body">
                    <div>
                      <div className="sv-rcard-name">{item.name}</div>
                      {item.subtitle ? <div className="sv-rcard-sub">{item.subtitle}</div> : null}
                      {item.variantSummary ? <CheckoutVariantPills summary={item.variantSummary} /> : null}
                    </div>
                    <div className="sv-rcard-bottom">
                      {cd ? <span className="sv-rcard-calc">{cd}</span> : null}
                      <span className="sv-rcard-total">{fmt(item.rowTotal, currencySymbol)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sv-review-customer" style={{ margin: '14px 0 0' }}>
            <div className="sv-review-customer-label">Ordering as</div>
            <div className="sv-review-customer-name">{customerName}</div>
            {customerWhatsappNumber ? (
              <div className="sv-review-customer-phone">
                {customerWhatsappCountry} {customerWhatsappNumber}
              </div>
            ) : null}
          </div>
          {orderNote.trim() || giftMessage.trim() ? (
            <div className="sv-review-customer" style={{ margin: '14px 0 0' }}>
              {orderNote.trim() ? (
                <div style={{ marginBottom: giftMessage.trim() ? 10 : 0 }}>
                  <div className="sv-review-customer-label">Order notes</div>
                  <div style={{ fontSize: 13, color: 'var(--c-text2)', whiteSpace: 'pre-wrap' }}>
                    {orderNote.trim()}
                  </div>
                </div>
              ) : null}
              {giftMessage.trim() ? (
                <div>
                  <div className="sv-review-customer-label">Gift message</div>
                  <div style={{ fontSize: 13, color: 'var(--c-text2)', whiteSpace: 'pre-wrap' }}>
                    {giftMessage.trim()}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        <section className="sv-checkout-section sv-checkout-section--summary">
          {showGatewayPaymentChoice ||
          showUpiPaymentChoice ||
          showPrepaidOption ||
          showUpiOption ||
          (showCodOption && (isGatewayPaymentMode || isUpiPaymentMode)) ? (
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--c-text2)' }}>
              Payment: <strong>{checkoutPaymentLabel}</strong>
              {resolvedPaymentChoice === 'cod' && checkoutTotals.codTotal > 0
                ? ` (includes ${fmt(checkoutTotals.codTotal, currencySymbol)} COD fee)`
                : ''}
            </div>
          ) : null}
          <CheckoutBreakdown
            totals={checkoutTotals}
            currencySymbol={currencySymbol}
            fmt={fmt}
            showBreakdown={checkoutSettings.showBreakdown && hasCheckoutRules}
          />
          <button type="button" className="sv-edit-btn" style={{ marginTop: 12 }} onClick={onEditItems}>
            Edit items
          </button>
        </section>
      </div>
    </div>
  );
}
