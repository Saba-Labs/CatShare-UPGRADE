/**
 * Flexible checkout rules for storefront: shipping, taxes, discounts/coupons.
 * Stored as JSONB on `stores.checkout_settings`.
 */

export type CheckoutRuleCategory = 'shipping' | 'tax' | 'discount';

export type CheckoutAmountKind = 'flat' | 'percent';

export type CheckoutPaymentMethod = 'any' | 'prepaid' | 'cod';

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
}

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

export function normalizeCheckoutSettings(raw: unknown): StoreCheckoutSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CHECKOUT_SETTINGS, rules: [] };
  }
  const o = raw as Record<string, unknown>;
  const rulesRaw = Array.isArray(o.rules) ? o.rules : [];
  const rules = rulesRaw.map(coerceRule).filter((r): r is CheckoutRule => r != null);
  rules.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  return {
    version: 1,
    rules,
    showBreakdown: o.showBreakdown !== false,
    allowCouponEntry: o.allowCouponEntry !== false,
    enableCod: o.enableCod === true,
  };
}

export function hasCodRules(settings: StoreCheckoutSettings | null | undefined): boolean {
  if (!settings) return false;
  return settings.rules.some(
    (r) => r.enabled && (r.type === 'cod_charge' || r.paymentMethod === 'cod')
  );
}
