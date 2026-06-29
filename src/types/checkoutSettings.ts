/**
 * Flexible checkout rules for storefront: shipping, taxes, discounts/coupons.
 * Stored as JSONB on `stores.checkout_settings`.
 */

export type CheckoutRuleCategory = 'shipping' | 'tax' | 'discount';

export type CheckoutAmountKind = 'flat' | 'percent';

export type CheckoutPaymentMethod = 'any' | 'prepaid' | 'cod';

/** How the seller collects payment from customers at checkout. */
export type StorePaymentCollectionMode = 'manual' | 'upi' | 'gateway';

/** How the seller fulfills / ships orders. */
export type StoreShippingCollectionMode = 'manual' | 'provider';

/** Stored on orders when customer checks out */
export type OrderCheckoutPaymentMethod = 'prepaid' | 'cod' | 'upi' | 'manual';

/** When the rule amount is calculated from */
export type CheckoutApplyBase = 'subtotal' | 'after_discount' | 'after_shipping';

export type CheckoutRuleType =
  | 'flat_shipping'
  | 'percent_shipping'
  | 'packing_charge'
  | 'cod_charge'
  | 'free_shipping_above'
  | 'tax_percent'
  | 'tax_flat'
  | 'tax_gst'
  | 'tax_cgst'
  | 'tax_sgst'
  | 'tax_igst'
  | 'tax_vat'
  | 'discount_percent'
  | 'discount_flat'
  | 'coupon_percent'
  | 'coupon_flat'
  | 'custom';

export interface CheckoutRule {
  id: string;
  type: CheckoutRuleType;
  category: CheckoutRuleCategory;
  label: string;
  enabled: boolean;
  /** flat amount or percent (0–100) depending on amountKind */
  value: number;
  amountKind: CheckoutAmountKind;
  /** Min cart subtotal before rule applies */
  minSubtotal?: number | null;
  /** For free_shipping_above — waive shipping when subtotal >= this */
  freeAbove?: number | null;
  /** Coupon code (coupon_* types) */
  code?: string | null;
  /** Cap for percent discounts */
  maxAmount?: number | null;
  /** Only apply for selected payment method */
  paymentMethod: CheckoutPaymentMethod;
  /** Tax/discount base */
  applyBase: CheckoutApplyBase;
  /** Sort order within category */
  order: number;
}

export interface StoreCheckoutSettings {
  version: 1;
  rules: CheckoutRule[];
  /** Show line-by-line breakdown on storefront checkout */
  showBreakdown: boolean;
  /** Allow customer to enter a coupon code at checkout */
  allowCouponEntry: boolean;
  /** Offer COD when any cod_charge rule exists */
  enableCod: boolean;
  /** Offer online / prepaid payment methods at checkout (gateway mode) */
  enablePrepaid: boolean;
  /** manual = seller handles payment offline; upi = show seller UPI; gateway = Razorpay/COD */
  paymentCollectionMode: StorePaymentCollectionMode;
  /** Seller UPI VPA when paymentCollectionMode is upi */
  sellerUpiId: string;
  /** manual = seller ships on their own; provider = Shiprocket / logistics integration */
  shippingCollectionMode: StoreShippingCollectionMode;
  experience: CheckoutExperienceSettings;
}

export type CheckoutTheme = 'default' | 'minimal' | 'premium' | 'contrast';

export interface CheckoutExperienceSettings {
  enableGiftNotes: boolean;
  giftNotesPlaceholder: string;
  enableOrderNotes: boolean;
  orderNotesPlaceholder: string;
  allowGuestCheckout: boolean;
  requireLoginBeforeCheckout: boolean;
  validateAddress: boolean;
  termsUrl: string;
  privacyUrl: string;
  returnPolicyUrl: string;
  refundPolicyUrl: string;
  orderConfirmationTitle: string;
  orderConfirmationMessage: string;
  showOrderSummaryOnConfirmation: boolean;
  checkoutTheme: CheckoutTheme;
}

export const DEFAULT_CHECKOUT_EXPERIENCE: CheckoutExperienceSettings = {
  enableGiftNotes: false,
  giftNotesPlaceholder: 'Add a gift message for the recipient',
  enableOrderNotes: true,
  orderNotesPlaceholder: 'Special instructions for your order',
  allowGuestCheckout: true,
  requireLoginBeforeCheckout: false,
  validateAddress: true,
  termsUrl: '',
  privacyUrl: '',
  returnPolicyUrl: '',
  refundPolicyUrl: '',
  orderConfirmationTitle: 'Thank you for your order!',
  orderConfirmationMessage: 'We have received your order and will notify you when it ships.',
  showOrderSummaryOnConfirmation: true,
  checkoutTheme: 'default',
};

export interface CheckoutLineItem {
  ruleId: string;
  label: string;
  category: CheckoutRuleCategory;
  amount: number;
}

export interface CheckoutTotals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  codTotal: number;
  grandTotal: number;
  lines: CheckoutLineItem[];
  freeShippingApplied: boolean;
  appliedCouponCode: string | null;
}

export const DEFAULT_CHECKOUT_SETTINGS: StoreCheckoutSettings = {
  version: 1,
  rules: [],
  showBreakdown: true,
  allowCouponEntry: true,
  enableCod: false,
  enablePrepaid: false,
  paymentCollectionMode: 'manual',
  sellerUpiId: '',
  shippingCollectionMode: 'manual',
  experience: { ...DEFAULT_CHECKOUT_EXPERIENCE },
};

export interface CheckoutRulePreset {
  type: CheckoutRuleType;
  category: CheckoutRuleCategory;
  label: string;
  amountKind: CheckoutAmountKind;
  defaultValue: number;
  paymentMethod?: CheckoutPaymentMethod;
  applyBase?: CheckoutApplyBase;
  hint?: string;
}

export const CHECKOUT_RULE_PRESETS: CheckoutRulePreset[] = [
  { type: 'flat_shipping', category: 'shipping', label: 'Flat shipping', amountKind: 'flat', defaultValue: 50, hint: 'Fixed delivery charge' },
  { type: 'percent_shipping', category: 'shipping', label: 'Shipping (% of order)', amountKind: 'percent', defaultValue: 5, hint: 'Percentage of subtotal' },
  { type: 'packing_charge', category: 'shipping', label: 'Packing charge', amountKind: 'flat', defaultValue: 30, hint: 'Packaging / handling fee' },
  { type: 'cod_charge', category: 'shipping', label: 'COD charge', amountKind: 'flat', defaultValue: 40, paymentMethod: 'cod', hint: 'Cash on delivery fee' },
  { type: 'free_shipping_above', category: 'shipping', label: 'Free shipping above', amountKind: 'flat', defaultValue: 0, hint: 'Waive shipping when order exceeds amount' },
  { type: 'tax_gst', category: 'tax', label: 'GST', amountKind: 'percent', defaultValue: 18, applyBase: 'after_discount', hint: 'Goods & Services Tax' },
  { type: 'tax_cgst', category: 'tax', label: 'CGST', amountKind: 'percent', defaultValue: 9, applyBase: 'after_discount' },
  { type: 'tax_sgst', category: 'tax', label: 'SGST', amountKind: 'percent', defaultValue: 9, applyBase: 'after_discount' },
  { type: 'tax_igst', category: 'tax', label: 'IGST', amountKind: 'percent', defaultValue: 18, applyBase: 'after_discount' },
  { type: 'tax_vat', category: 'tax', label: 'VAT', amountKind: 'percent', defaultValue: 5, applyBase: 'after_discount' },
  { type: 'tax_percent', category: 'tax', label: 'Tax (%)', amountKind: 'percent', defaultValue: 5, applyBase: 'after_discount' },
  { type: 'tax_flat', category: 'tax', label: 'Tax (flat)', amountKind: 'flat', defaultValue: 0, applyBase: 'after_discount' },
  { type: 'discount_percent', category: 'discount', label: 'Order discount (%)', amountKind: 'percent', defaultValue: 10, applyBase: 'subtotal', hint: 'Auto-applied on all orders' },
  { type: 'discount_flat', category: 'discount', label: 'Order discount (flat)', amountKind: 'flat', defaultValue: 50, applyBase: 'subtotal' },
  { type: 'coupon_percent', category: 'discount', label: 'Coupon (%)', amountKind: 'percent', defaultValue: 10, applyBase: 'subtotal', hint: 'Customer enters code at checkout' },
  { type: 'coupon_flat', category: 'discount', label: 'Coupon (flat off)', amountKind: 'flat', defaultValue: 100, applyBase: 'subtotal' },
  { type: 'custom', category: 'shipping', label: 'Custom shipping rule', amountKind: 'flat', defaultValue: 0, hint: 'Your own label and conditions' },
  { type: 'custom', category: 'tax', label: 'Custom tax rule', amountKind: 'percent', defaultValue: 0, applyBase: 'after_discount', hint: 'Your own tax label and base' },
  { type: 'custom', category: 'discount', label: 'Custom discount', amountKind: 'flat', defaultValue: 0, applyBase: 'subtotal', hint: 'Auto or coupon-style discount' },
];

function categoryForType(type: CheckoutRuleType): CheckoutRuleCategory {
  if (type.startsWith('tax_')) return 'tax';
  if (type.startsWith('discount_') || type.startsWith('coupon_')) return 'discount';
  return 'shipping';
}

function newRuleId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRuleFromPreset(preset: CheckoutRulePreset): CheckoutRule {
  return {
    id: newRuleId(),
    type: preset.type,
    category: preset.category,
    label: preset.label,
    enabled: true,
    value: preset.defaultValue,
    amountKind: preset.amountKind,
    paymentMethod: preset.paymentMethod ?? 'any',
    applyBase: preset.applyBase ?? 'subtotal',
    order: Date.now(),
    code: preset.type.startsWith('coupon_') ? '' : null,
    freeAbove: preset.type === 'free_shipping_above' ? 999 : null,
  };
}

function coerceNumber(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : fallback;
}

function coerceRule(raw: unknown): CheckoutRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const type = String(r.type ?? 'custom') as CheckoutRuleType;
  const id = String(r.id ?? newRuleId());
  const amountKind: CheckoutAmountKind = r.amountKind === 'percent' ? 'percent' : 'flat';
  const paymentMethod = (['any', 'prepaid', 'cod'] as const).includes(r.paymentMethod as CheckoutPaymentMethod)
    ? (r.paymentMethod as CheckoutPaymentMethod)
    : 'any';
  const applyBase = (['subtotal', 'after_discount', 'after_shipping'] as const).includes(r.applyBase as CheckoutApplyBase)
    ? (r.applyBase as CheckoutApplyBase)
    : 'subtotal';
  return {
    id,
    type,
    category: (r.category as CheckoutRuleCategory) || categoryForType(type),
    label: String(r.label ?? 'Charge'),
    enabled: r.enabled !== false,
    value: coerceNumber(r.value),
    amountKind,
    minSubtotal: r.minSubtotal != null ? coerceNumber(r.minSubtotal, 0) || null : null,
    freeAbove: r.freeAbove != null ? coerceNumber(r.freeAbove, 0) || null : null,
    code: r.code != null ? String(r.code) : null,
    maxAmount: r.maxAmount != null ? coerceNumber(r.maxAmount, 0) || null : null,
    paymentMethod,
    applyBase,
    order: coerceNumber(r.order, 0),
  };
}

function normalizeExperience(raw: unknown): CheckoutExperienceSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CHECKOUT_EXPERIENCE };
  }
  const o = raw as Record<string, unknown>;
  const theme = (['default', 'minimal', 'premium', 'contrast'] as const).includes(
    o.checkoutTheme as CheckoutTheme
  )
    ? (o.checkoutTheme as CheckoutTheme)
    : 'default';

  return {
    enableGiftNotes: o.enableGiftNotes === true,
    giftNotesPlaceholder:
      typeof o.giftNotesPlaceholder === 'string' && o.giftNotesPlaceholder.trim()
        ? o.giftNotesPlaceholder
        : DEFAULT_CHECKOUT_EXPERIENCE.giftNotesPlaceholder,
    enableOrderNotes: o.enableOrderNotes !== false,
    orderNotesPlaceholder:
      typeof o.orderNotesPlaceholder === 'string' && o.orderNotesPlaceholder.trim()
        ? o.orderNotesPlaceholder
        : DEFAULT_CHECKOUT_EXPERIENCE.orderNotesPlaceholder,
    allowGuestCheckout: o.requireLoginBeforeCheckout === true ? false : o.allowGuestCheckout !== false,
    requireLoginBeforeCheckout: o.requireLoginBeforeCheckout === true,
    validateAddress: o.validateAddress !== false,
    termsUrl: typeof o.termsUrl === 'string' ? o.termsUrl : '',
    privacyUrl: typeof o.privacyUrl === 'string' ? o.privacyUrl : '',
    returnPolicyUrl: typeof o.returnPolicyUrl === 'string' ? o.returnPolicyUrl : '',
    refundPolicyUrl: typeof o.refundPolicyUrl === 'string' ? o.refundPolicyUrl : '',
    orderConfirmationTitle:
      typeof o.orderConfirmationTitle === 'string' && o.orderConfirmationTitle.trim()
        ? o.orderConfirmationTitle
        : DEFAULT_CHECKOUT_EXPERIENCE.orderConfirmationTitle,
    orderConfirmationMessage:
      typeof o.orderConfirmationMessage === 'string' && o.orderConfirmationMessage.trim()
        ? o.orderConfirmationMessage
        : DEFAULT_CHECKOUT_EXPERIENCE.orderConfirmationMessage,
    showOrderSummaryOnConfirmation: o.showOrderSummaryOnConfirmation !== false,
    checkoutTheme: theme,
  };
}

function normalizePaymentCollectionMode(o: Record<string, unknown>): StorePaymentCollectionMode {
  const raw = o.paymentCollectionMode;
  if (raw === 'manual' || raw === 'upi' || raw === 'gateway') return raw;
  if (o.enablePrepaid !== false) return 'gateway';
  return 'manual';
}

function normalizeShippingCollectionMode(o: Record<string, unknown>): StoreShippingCollectionMode {
  const raw = o.shippingCollectionMode;
  if (raw === 'manual' || raw === 'provider') return raw;
  return 'manual';
}

export function normalizeCheckoutSettings(raw: unknown): StoreCheckoutSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CHECKOUT_SETTINGS, rules: [] };
  }
  const o = raw as Record<string, unknown>;
  const rulesRaw = Array.isArray(o.rules) ? o.rules : [];
  const rules = rulesRaw.map(coerceRule).filter((r): r is CheckoutRule => r != null);
  rules.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  const paymentCollectionMode = normalizePaymentCollectionMode(o);
  const shippingCollectionMode = normalizeShippingCollectionMode(o);
  return {
    version: 1,
    rules,
    showBreakdown: o.showBreakdown !== false,
    allowCouponEntry: o.allowCouponEntry !== false,
    enableCod: o.enableCod === true,
    enablePrepaid: o.enablePrepaid === true,
    paymentCollectionMode,
    sellerUpiId: typeof o.sellerUpiId === 'string' ? o.sellerUpiId.trim().toLowerCase() : '',
    shippingCollectionMode,
    experience: normalizeExperience(o.experience),
  };
}

export function hasCodRules(settings: StoreCheckoutSettings | null | undefined): boolean {
  if (!settings) return false;
  return settings.rules.some(
    (r) => r.enabled && (r.type === 'cod_charge' || r.paymentMethod === 'cod')
  );
}
