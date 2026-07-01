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
  | 'coupon_category_percent'
  | 'coupon_category_flat'
  | 'coupon_product_percent'
  | 'coupon_product_flat'
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
  /** Max cart subtotal — rule does not apply above this */
  maxSubtotal?: number | null;
  /** For free_shipping_above — waive shipping when subtotal >= this */
  freeAbove?: number | null;
  /** Coupon code (coupon_* types) */
  code?: string | null;
  /** When set, category coupons only apply if the cart contains items in these categories */
  allowedCategories?: string[] | null;
  /** When set, product coupons only apply if the cart contains these product IDs */
  allowedProductIds?: string[] | null;
  /** ISO datetime — coupon stops working after this moment */
  expiresAt?: string | null;
  /** Limit each WhatsApp / phone number to one redemption of this code */
  oncePerCustomer?: boolean;
  /** Max total orders that may use this coupon code (all customers) */
  maxTotalUses?: number | null;
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

export interface CheckoutCustomerNotes {
  orderNote?: string | null;
  giftMessage?: string | null;
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
  /** Gift message / order instructions captured at checkout */
  customerNotes?: CheckoutCustomerNotes;
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
  { type: 'discount_percent', category: 'discount', label: 'Auto discount (%)', amountKind: 'percent', defaultValue: 10, applyBase: 'subtotal', hint: 'Applied automatically when order qualifies' },
  { type: 'discount_flat', category: 'discount', label: 'Auto discount (flat)', amountKind: 'flat', defaultValue: 50, applyBase: 'subtotal', hint: 'Fixed off when order qualifies' },
  { type: 'coupon_percent', category: 'discount', label: 'Coupon (%)', amountKind: 'percent', defaultValue: 10, applyBase: 'subtotal', hint: 'Applies to the whole order' },
  { type: 'coupon_flat', category: 'discount', label: 'Coupon (flat off)', amountKind: 'flat', defaultValue: 100, applyBase: 'subtotal', hint: 'Fixed off the whole order' },
  { type: 'coupon_category_percent', category: 'discount', label: 'Category coupon (%)', amountKind: 'percent', defaultValue: 10, applyBase: 'subtotal', hint: 'Percent off selected categories only' },
  { type: 'coupon_category_flat', category: 'discount', label: 'Category coupon (flat off)', amountKind: 'flat', defaultValue: 100, applyBase: 'subtotal', hint: 'Fixed off selected categories only' },
  { type: 'coupon_product_percent', category: 'discount', label: 'Product coupon (%)', amountKind: 'percent', defaultValue: 10, applyBase: 'subtotal', hint: 'Percent off selected products only' },
  { type: 'coupon_product_flat', category: 'discount', label: 'Product coupon (flat off)', amountKind: 'flat', defaultValue: 100, applyBase: 'subtotal', hint: 'Fixed off selected products only' },
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
  const isCoupon = preset.type.startsWith('coupon_');
  const isCategoryCoupon = isCategoryCouponRuleType(preset.type);
  const isProductCoupon = isProductCouponRuleType(preset.type);
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
    code: isCoupon ? '' : null,
    allowedCategories: isCategoryCoupon ? [] : undefined,
    allowedProductIds: isProductCoupon ? [] : undefined,
    oncePerCustomer: isCoupon ? false : undefined,
    maxTotalUses: isCoupon ? null : undefined,
    expiresAt: isCoupon ? null : undefined,
    freeAbove: preset.type === 'free_shipping_above' ? 999 : null,
  };
}

function coerceNumber(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : fallback;
}

function coerceStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const values = Array.from(
    new Set(raw.map((item) => String(item ?? '').trim()).filter(Boolean))
  );
  return values.length > 0 ? values : null;
}

function migrateLegacyCouponType(
  type: CheckoutRuleType,
  allowedCategories: string[] | null
): CheckoutRuleType {
  if (
    (type === 'coupon_percent' || type === 'coupon_flat') &&
    allowedCategories &&
    allowedCategories.length > 0
  ) {
    return type === 'coupon_percent' ? 'coupon_category_percent' : 'coupon_category_flat';
  }
  return type;
}

function coerceRule(raw: unknown): CheckoutRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  let type = String(r.type ?? 'custom') as CheckoutRuleType;
  const id = String(r.id ?? newRuleId());
  const amountKind: CheckoutAmountKind = r.amountKind === 'percent' ? 'percent' : 'flat';
  const paymentMethod = (['any', 'prepaid', 'cod'] as const).includes(r.paymentMethod as CheckoutPaymentMethod)
    ? (r.paymentMethod as CheckoutPaymentMethod)
    : 'any';
  const applyBase = (['subtotal', 'after_discount', 'after_shipping'] as const).includes(r.applyBase as CheckoutApplyBase)
    ? (r.applyBase as CheckoutApplyBase)
    : 'subtotal';
  const allowedCategories = coerceStringArray(r.allowedCategories);
  type = migrateLegacyCouponType(type, allowedCategories);
  const isCategoryCoupon = isCategoryCouponRuleType(type);
  const isProductCoupon = isProductCouponRuleType(type);
  const isPlainCoupon = type === 'coupon_percent' || type === 'coupon_flat';
  let expiresAt: string | null = null;
  if (typeof r.expiresAt === 'string' && r.expiresAt.trim()) {
    const parsed = new Date(r.expiresAt);
    expiresAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return {
    id,
    type,
    category: (r.category as CheckoutRuleCategory) || categoryForType(type),
    label: String(r.label ?? 'Charge'),
    enabled: r.enabled !== false,
    value: coerceNumber(r.value),
    amountKind,
    minSubtotal: r.minSubtotal != null ? coerceNumber(r.minSubtotal, 0) || null : null,
    maxSubtotal: r.maxSubtotal != null ? coerceNumber(r.maxSubtotal, 0) || null : null,
    freeAbove: r.freeAbove != null ? coerceNumber(r.freeAbove, 0) || null : null,
    code: r.code != null ? String(r.code) : null,
    allowedCategories: isCategoryCoupon ? allowedCategories ?? [] : isPlainCoupon ? null : undefined,
    allowedProductIds: isProductCoupon ? coerceStringArray(r.allowedProductIds) ?? [] : undefined,
    expiresAt: type.startsWith('coupon_') ? expiresAt : undefined,
    oncePerCustomer: r.oncePerCustomer === true,
    maxTotalUses:
      r.maxTotalUses != null && r.maxTotalUses !== ''
        ? coerceNumber(r.maxTotalUses, 0) || null
        : null,
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

export function describeCheckoutRule(rule: CheckoutRule): string {
  switch (rule.type) {
    case 'coupon_percent':
    case 'coupon_flat':
      return 'Applies to the whole order when the customer enters the code.';
    case 'coupon_category_percent':
    case 'coupon_category_flat':
      return 'Applies only to items in the selected categories.';
    case 'coupon_product_percent':
    case 'coupon_product_flat':
      return 'Applies only to the selected products.';
    case 'discount_percent':
    case 'discount_flat':
      return 'Applied automatically when the order qualifies.';
    case 'cod_charge':
      return 'Only when customer pays cash on delivery. Set min/max order to limit when the fee applies.';
    case 'free_shipping_above':
      return 'Waives delivery charges above the threshold.';
    case 'flat_shipping':
    case 'percent_shipping':
      return 'Delivery fee added to qualifying orders.';
    case 'packing_charge':
      return 'Packaging / handling fee on qualifying orders.';
    default:
      if (rule.category === 'tax') return 'Tax calculated on the selected order base.';
      return 'Applied when conditions below are met.';
  }
}

export function isCouponRuleType(type: CheckoutRuleType): boolean {
  return type.startsWith('coupon_');
}

export function isCategoryCouponRuleType(type: CheckoutRuleType): boolean {
  return type === 'coupon_category_percent' || type === 'coupon_category_flat';
}

export function isProductCouponRuleType(type: CheckoutRuleType): boolean {
  return type === 'coupon_product_percent' || type === 'coupon_product_flat';
}

export function isPlainCouponRuleType(type: CheckoutRuleType): boolean {
  return type === 'coupon_percent' || type === 'coupon_flat';
}

export function parseCouponExpiresAt(raw: string | null | undefined): Date | null {
  if (!raw || !String(raw).trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isCouponRuleExpired(rule: CheckoutRule, now = Date.now()): boolean {
  if (!isCouponRuleType(rule.type)) return false;
  const expires = parseCouponExpiresAt(rule.expiresAt);
  return expires != null && expires.getTime() <= now;
}

export function expiresAtToDatetimeLocal(iso: string | null | undefined): string {
  const d = parseCouponExpiresAt(iso);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function expiresAtToDateInput(iso: string | null | undefined): string {
  const d = parseCouponExpiresAt(iso);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function expiresAtToTimeInput(iso: string | null | undefined): string {
  const d = parseCouponExpiresAt(iso);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateTimeInputsToExpiresAt(date: string, time: string): string | null {
  const datePart = date.trim();
  if (!datePart) return null;
  const timePart = time.trim() || '23:59';
  return datetimeLocalToExpiresAt(`${datePart}T${timePart}`);
}

export function formatCouponExpiryPreview(iso: string | null | undefined): string | null {
  const d = parseCouponExpiresAt(iso);
  if (!d) return null;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function datetimeLocalToExpiresAt(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatCouponExpirySummary(rule: CheckoutRule): string | null {
  const expires = parseCouponExpiresAt(rule.expiresAt);
  if (!expires) return null;
  if (isCouponRuleExpired(rule)) return 'Expired';
  return `Ends ${expires.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

/** Disable coupons whose end date has passed. Returns labels of rules that were turned off. */
export function disableExpiredCouponRules(
  settings: StoreCheckoutSettings
): { settings: StoreCheckoutSettings; disabledLabels: string[] } {
  const disabledLabels: string[] = [];
  const rules = settings.rules.map((rule) => {
    if (!isCouponRuleType(rule.type) || !rule.enabled) return rule;
    if (!isCouponRuleExpired(rule)) return rule;
    disabledLabels.push(rule.label);
    return { ...rule, enabled: false };
  });
  return {
    settings: { ...settings, rules },
    disabledLabels,
  };
}

export function isAutoDiscountRuleType(type: CheckoutRuleType): boolean {
  return type === 'discount_percent' || type === 'discount_flat';
}

/** One-line summary for compact rule list rows */
export function summarizeCheckoutRule(rule: CheckoutRule): string {
  const parts: string[] = [];
  const isFreeShipping = rule.type === 'free_shipping_above';
  const isPercent = rule.amountKind === 'percent' && !isFreeShipping;
  const isCoupon = isCouponRuleType(rule.type);

  if (isFreeShipping) {
    if (rule.freeAbove != null && rule.freeAbove > 0) {
      parts.push(`Free above ₹${rule.freeAbove}`);
    }
  } else if (isPercent) {
    parts.push(`${rule.value}%`);
    if (rule.maxAmount != null && rule.maxAmount > 0) {
      parts.push(`cap ₹${rule.maxAmount}`);
    }
  } else if (rule.value > 0) {
    parts.push(`₹${rule.value}`);
  }

  if (isCoupon && rule.code?.trim()) {
    parts.push(`code ${rule.code.trim().toUpperCase()}`);
  }
  if (isCoupon && rule.oncePerCustomer) {
    parts.push('1× per customer');
  }
  if (isCoupon && rule.maxTotalUses != null && rule.maxTotalUses > 0) {
    parts.push(`${rule.maxTotalUses} total`);
  }
  if (isCoupon) {
    const expiry = formatCouponExpirySummary(rule);
    if (expiry) parts.push(expiry);
  }
  if (isCategoryCouponRuleType(rule.type)) {
    const cats = Array.isArray(rule.allowedCategories)
      ? rule.allowedCategories.map((c) => String(c).trim()).filter(Boolean)
      : [];
    if (cats.length > 0) {
      parts.push(
        cats.length <= 2 ? cats.join(', ') : `${cats.slice(0, 2).join(', ')} +${cats.length - 2}`
      );
    }
  }
  if (isProductCouponRuleType(rule.type)) {
    const count = Array.isArray(rule.allowedProductIds) ? rule.allowedProductIds.length : 0;
    if (count > 0) {
      parts.push(`${count} product${count === 1 ? '' : 's'}`);
    }
  }

  const range: string[] = [];
  if (rule.minSubtotal != null && rule.minSubtotal > 0) {
    range.push(`from ₹${rule.minSubtotal}`);
  }
  if (rule.maxSubtotal != null && rule.maxSubtotal > 0) {
    range.push(`up to ₹${rule.maxSubtotal}`);
  }
  if (range.length) parts.push(range.join(' '));

  return parts.join(' · ') || describeCheckoutRule(rule);
}
