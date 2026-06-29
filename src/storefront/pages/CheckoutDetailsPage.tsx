import CheckoutBreakdown from '../../components/Storefront/CheckoutBreakdown';
import { getCatalogueData, normalizeOrderQuantityStep, type ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StoreCheckoutSettings } from '../../types/checkoutSettings';
import { isDisplayableImageUrl, productImageDisplayUrl } from '../../utils/imageUrl';
import type { CheckoutTotals } from '../../types/checkoutSettings';
import { CheckoutIconImg, CheckoutQtyControl, CheckoutVariantPills } from '../components/CheckoutUi';

export interface CheckoutOrderLine {
  lineId: string;
  productId: string;
  name: string;
  subtitle?: string;
  variantSummary?: string;
  imageUrl?: string;
  imageVersion?: number;
  quantity: number;
  unitPrice: number;
  priceUnit?: string;
  quantityStep?: number;
  rowTotal: number;
}

interface CheckoutDetailsPageProps {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerWhatsappCountry: string;
  onCustomerWhatsappCountryChange: (value: string) => void;
  customerWhatsappNumber: string;
  onCustomerWhatsappNumberChange: (value: string) => void;
  requiresShippingAddress: boolean;
  shipLine1: string;
  onShipLine1Change: (value: string) => void;
  shipCity: string;
  onShipCityChange: (value: string) => void;
  shipState: string;
  onShipStateChange: (value: string) => void;
  shipPincode: string;
  onShipPincodeChange: (value: string) => void;
  minimumOrderValue: number;
  minimumOrderMet: boolean;
  remainingToMinimum: number;
  checkoutPaymentChoices: Array<
    | { id: 'prepaid' | 'cod' | 'upi'; label: string }
    | { id: 'upi'; label: string; locked: true }
  > | null;
  isCheckoutPaymentSelected: (id: 'prepaid' | 'cod' | 'upi') => boolean;
  onSelectCheckoutPayment: (id: 'prepaid' | 'cod' | 'upi') => void;
  showPrepaidOption: boolean;
  showCodOption: boolean;
  checkoutSettings: StoreCheckoutSettings;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  checkoutTotals: CheckoutTotals;
  hasCheckoutRules: boolean;
  orderItems: CheckoutOrderLine[];
  listingCatalogueId: string | null;
  allProducts: ProductWithCatalogueData[];
  currencySymbol: string;
  fmt: (amount: number, symbol: string) => string;
  fmtCalc: (
    qty: number,
    unitPrice: number,
    priceUnit: string | undefined,
    symbol: string,
    step?: number
  ) => string | null;
  onChangeCartLineQty: (lineId: string, delta: number) => void;
}

export default function CheckoutDetailsPage({
  customerName,
  onCustomerNameChange,
  customerWhatsappCountry,
  onCustomerWhatsappCountryChange,
  customerWhatsappNumber,
  onCustomerWhatsappNumberChange,
  requiresShippingAddress,
  shipLine1,
  onShipLine1Change,
  shipCity,
  onShipCityChange,
  shipState,
  onShipStateChange,
  shipPincode,
  onShipPincodeChange,
  minimumOrderValue,
  minimumOrderMet,
  remainingToMinimum,
  checkoutPaymentChoices,
  isCheckoutPaymentSelected,
  onSelectCheckoutPayment,
  showPrepaidOption,
  showCodOption,
  checkoutSettings,
  couponCode,
  onCouponCodeChange,
  checkoutTotals,
  hasCheckoutRules,
  orderItems,
  listingCatalogueId,
  allProducts,
  currencySymbol,
  fmt,
  fmtCalc,
  onChangeCartLineQty,
}: CheckoutDetailsPageProps) {
  return (
    <div className="sv-checkout-content">
      <div className="sv-checkout-grid sv-checkout-grid--details">
        <div className="sv-checkout-column sv-checkout-column--main">
          {(!customerName.trim() || !customerWhatsappNumber.trim()) && (
            <div className="sv-checkout-alert">Name and WhatsApp are required to continue.</div>
          )}
          {requiresShippingAddress &&
            (!shipLine1.trim() ||
              !shipCity.trim() ||
              !shipState.trim() ||
              shipPincode.replace(/\D/g, '').length !== 6) && (
              <div className="sv-checkout-alert">
                Delivery address is required because shipping is enabled on this store.
              </div>
            )}
          {minimumOrderValue > 0 && !minimumOrderMet && (
            <div className="sv-checkout-alert">
              Minimum order is {fmt(minimumOrderValue, currencySymbol)}. Add{' '}
              {fmt(remainingToMinimum, currencySymbol)} more to continue.
            </div>
          )}

          <div className="sv-checkout-card">
            <h2 className="sv-checkout-card-title">Contact details</h2>
            <div className="sv-checkout-fields">
              <div className="sv-field">
                <label>Your name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => onCustomerNameChange(e.target.value)}
                  placeholder="Enter your full name"
                  autoFocus
                />
              </div>
              <div className="sv-field">
                <label>WhatsApp number *</label>
                <div className="sv-phone-group">
                  <div className="sv-phone-group-country">
                    <input
                      type="text"
                      value={customerWhatsappCountry}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d+]/g, '');
                        onCustomerWhatsappCountryChange(
                          val.startsWith('+') ? val : '+' + val.replace(/\+/g, '')
                        );
                      }}
                      placeholder="+91"
                      maxLength={5}
                      inputMode="tel"
                      aria-label="Country code"
                    />
                  </div>
                  <div className="sv-phone-group-number">
                    <input
                      type="text"
                      value={customerWhatsappNumber}
                      onChange={(e) => onCustomerWhatsappNumberChange(e.target.value.replace(/\D/g, ''))}
                      placeholder="98xxxxxxxx"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {requiresShippingAddress ? (
            <div className="sv-checkout-card">
              <h2 className="sv-checkout-card-title">Delivery address</h2>
              <div className="sv-checkout-fields">
                <div className="sv-field">
                  <label>Street / building / area *</label>
                  <input
                    type="text"
                    value={shipLine1}
                    onChange={(e) => onShipLine1Change(e.target.value)}
                    placeholder="House no., street, area"
                  />
                </div>
                <div className="sv-field-row sv-field-row--3">
                  <div className="sv-field">
                    <label>City *</label>
                    <input
                      type="text"
                      value={shipCity}
                      onChange={(e) => onShipCityChange(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="sv-field">
                    <label>State *</label>
                    <input
                      type="text"
                      value={shipState}
                      onChange={(e) => onShipStateChange(e.target.value)}
                      placeholder="State"
                    />
                  </div>
                  <div className="sv-field sv-field--pincode">
                    <label>Pincode *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={shipPincode}
                      onChange={(e) => onShipPincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="sv-checkout-column sv-checkout-column--aside">
          {checkoutPaymentChoices ? (
            <div className="sv-checkout-card">
              <h2 className="sv-checkout-card-title">Payment method</h2>
              <div className="sv-payment-options" role="radiogroup" aria-label="Payment method">
                {checkoutPaymentChoices.map((choice) => {
                  const selected = isCheckoutPaymentSelected(choice.id);
                  const locked = 'locked' in choice && choice.locked;
                  return (
                    <label
                      key={choice.id}
                      className={`sv-payment-radio${selected ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
                    >
                      <input
                        type="radio"
                        name="store-checkout-payment"
                        className="sv-payment-radio-input"
                        checked={selected}
                        disabled={locked}
                        onChange={() => onSelectCheckoutPayment(choice.id)}
                      />
                      <span className="sv-payment-radio-mark" aria-hidden>
                        <span className="sv-payment-radio-dot" />
                      </span>
                      <span className="sv-payment-radio-label">{choice.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : showPrepaidOption ? (
            <div className="sv-checkout-card sv-checkout-card--compact">
              <h2 className="sv-checkout-card-title">Payment</h2>
              <p className="sv-checkout-card-note">
                You will pay online securely via Razorpay after confirming the order.
              </p>
            </div>
          ) : showCodOption ? (
            <div className="sv-checkout-card sv-checkout-card--compact">
              <h2 className="sv-checkout-card-title">Payment</h2>
              <p className="sv-checkout-card-note">
                Cash on delivery
                {checkoutTotals.codTotal > 0
                  ? ` (includes ${fmt(checkoutTotals.codTotal, currencySymbol)} COD fee)`
                  : ''}
              </p>
            </div>
          ) : null}

          {checkoutSettings.allowCouponEntry &&
          checkoutSettings.rules.some((r) => r.enabled && r.type.startsWith('coupon_')) ? (
            <div className="sv-checkout-card sv-checkout-card--compact">
              <h2 className="sv-checkout-card-title">Coupon code</h2>
              <div className="sv-coupon-row">
                <input
                  type="text"
                  className="sv-coupon-input"
                  placeholder="Enter code"
                  value={couponCode}
                  onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                />
              </div>
              {couponCode.trim() && !checkoutTotals.appliedCouponCode ? (
                <p className="sv-checkout-coupon-hint">Code not recognized or does not apply to this order.</p>
              ) : null}
            </div>
          ) : null}

          {orderItems.length > 0 ? (
            <div className="sv-checkout-card sv-checkout-card--summary">
              <h2 className="sv-checkout-card-title">Your order</h2>
              <div className="sv-review-list">
                {orderItems.map((item) => {
                  const catData = listingCatalogueId
                    ? getCatalogueData(allProducts.find((p) => p.id === item.productId), listingCatalogueId)
                    : null;
                  const qstep = catData ? normalizeOrderQuantityStep(catData.orderQuantityStep) : 1;
                  const cd =
                    item.quantity > 0
                      ? fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol, item.quantityStep)
                      : null;
                  return (
                    <div
                      key={item.lineId}
                      className={`sv-checkout-item-card${item.quantity === 0 ? ' is-muted' : ''}`}
                    >
                      <div className="sv-checkout-item-row">
                        <div className="sv-checkout-item-thumb">
                          {(() => {
                            const src = productImageDisplayUrl(item.imageUrl, item.imageVersion);
                            return isDisplayableImageUrl(src) ? (
                              <img key={src} src={src} alt={item.name} />
                            ) : (
                              <div className="sv-checkout-item-thumb-ph">
                                <CheckoutIconImg size={24} />
                              </div>
                            );
                          })()}
                        </div>
                        <div className="sv-checkout-item-main">
                          <div className="sv-checkout-item-text">
                            <div className="sv-checkout-item-name">{item.name}</div>
                            {item.subtitle ? <div className="sv-checkout-item-sub">{item.subtitle}</div> : null}
                            {item.variantSummary ? <CheckoutVariantPills summary={item.variantSummary} /> : null}
                          </div>
                          <div style={{ alignSelf: 'flex-start' }}>
                            <CheckoutQtyControl
                              value={item.quantity}
                              step={qstep}
                              onChange={(delta) => onChangeCartLineQty(item.lineId, delta)}
                              accent={item.quantity > 0}
                            />
                          </div>
                        </div>
                      </div>
                      {cd ? (
                        <div className="sv-checkout-item-footer">
                          <span>{cd}</span>
                          <span className="sv-checkout-line-total">{fmt(item.rowTotal, currencySymbol)}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <CheckoutBreakdown
                totals={checkoutTotals}
                currencySymbol={currencySymbol}
                fmt={fmt}
                showBreakdown={checkoutSettings.showBreakdown && hasCheckoutRules}
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
