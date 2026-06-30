export type { CheckoutTotals } from '../types/checkoutSettings';
import type { CheckoutApplyBase, CheckoutLineItem, CheckoutRule, CheckoutTotals, StoreCheckoutSettings } from '../types/checkoutSettings';
import { normalizeCheckoutSettings } from '../types/checkoutSettings';

export type CheckoutComputeOptions = {
  couponCode?: string;
  paymentMethod?: 'prepaid' | 'cod';
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function ruleMatchesPayment(rule: CheckoutRule, paymentMethod: 'prepaid' | 'cod'): boolean {
  if (rule.paymentMethod === 'any') return true;
  return rule.paymentMethod === paymentMethod;
}

function ruleMatchesSubtotal(rule: CheckoutRule, subtotal: number): boolean {
  const min = rule.minSubtotal;
  const max = rule.maxSubtotal;
  if (min != null && min > 0 && subtotal < min) return false;
  if (max != null && max > 0 && subtotal > max) return false;
  return true;
}

function isCouponRule(rule: CheckoutRule): boolean {
  return rule.type === 'coupon_percent' || rule.type === 'coupon_flat';
}

function isAutoDiscountRule(rule: CheckoutRule): boolean {
  return rule.type === 'discount_percent' || rule.type === 'discount_flat';
}

function isShippingChargeRule(rule: CheckoutRule): boolean {
  return (
    rule.type === 'flat_shipping' ||
    rule.type === 'percent_shipping' ||
    rule.type === 'packing_charge' ||
    (rule.type === 'custom' && rule.category === 'shipping')
  );
}

function isCodRule(rule: CheckoutRule): boolean {
  return rule.type === 'cod_charge' || (rule.type === 'custom' && rule.paymentMethod === 'cod');
}

function isTaxRule(rule: CheckoutRule): boolean {
  return rule.category === 'tax' || rule.type.startsWith('tax_');
}

function computeAmount(rule: CheckoutRule, base: number): number {
  if (rule.amountKind === 'percent') {
    let amt = (base * rule.value) / 100;
    if (rule.maxAmount != null && rule.maxAmount > 0) {
      amt = Math.min(amt, rule.maxAmount);
    }
    return roundMoney(amt);
  }
  return roundMoney(rule.value);
}

function resolveBase(applyBase: CheckoutApplyBase, ctx: { subtotal: number; afterDiscount: number; afterShipping: number }): number {
  switch (applyBase) {
    case 'after_discount':
      return ctx.afterDiscount;
    case 'after_shipping':
      return ctx.afterShipping;
    default:
      return ctx.subtotal;
  }
}

function normalizeCoupon(code: string | undefined): string {
  return String(code ?? '').trim().toUpperCase();
}

function couponMatches(rule: CheckoutRule, couponCode: string | undefined): boolean {
  const entered = normalizeCoupon(couponCode);
  const expected = normalizeCoupon(rule.code ?? '');
  return entered.length > 0 && expected.length > 0 && entered === expected;
}

export function computeCheckoutTotals(
  subtotal: number,
  rawSettings: StoreCheckoutSettings | null | undefined,
  options: CheckoutComputeOptions = {}
): CheckoutTotals {
  const settings = normalizeCheckoutSettings(rawSettings);
  const paymentMethod = options.paymentMethod ?? 'prepaid';
  const sub = roundMoney(Math.max(0, subtotal));

  const lines: CheckoutLineItem[] = [];
  let discountTotal = 0;
  let shippingTotal = 0;
  let taxTotal = 0;
  let codTotal = 0;
  let appliedCouponCode: string | null = null;

  const enabledRules = settings.rules.filter((r) => r.enabled);

  const freeShippingRule = enabledRules.find((r) => r.type === 'free_shipping_above');
  const freeThreshold = freeShippingRule?.freeAbove ?? freeShippingRule?.minSubtotal ?? null;
  const freeShippingApplied =
    freeThreshold != null && freeThreshold > 0 && sub >= freeThreshold;

  // —— Automatic discounts ——
  const autoDiscountRules = enabledRules.filter(
    (r) =>
      (isAutoDiscountRule(r) || (r.type === 'custom' && r.category === 'discount')) &&
      ruleMatchesPayment(r, paymentMethod) &&
      ruleMatchesSubtotal(r, sub)
  );

  for (const rule of autoDiscountRules) {
    const base = resolveBase(rule.applyBase, {
      subtotal: sub,
      afterDiscount: sub - discountTotal,
      afterShipping: sub - discountTotal,
    });
    const rawAmt = computeAmount(rule, base);
    if (rawAmt <= 0) continue;
    const amt = -Math.abs(rawAmt);
    discountTotal += Math.abs(amt);
    lines.push({ ruleId: rule.id, label: rule.label, category: 'discount', amount: amt });
  }

  discountTotal = roundMoney(discountTotal);
  let afterDiscount = roundMoney(Math.max(0, sub - discountTotal));

  // —— Coupon (one matching code, only when entry is enabled) ——
  if (settings.allowCouponEntry) {
    const enteredCoupon = normalizeCoupon(options.couponCode);
    if (enteredCoupon) {
      const couponRules = enabledRules.filter(
        (r) =>
          isCouponRule(r) &&
          ruleMatchesPayment(r, paymentMethod) &&
          ruleMatchesSubtotal(r, sub)
      );
      const matchedCoupon = couponRules.find((rule) => couponMatches(rule, enteredCoupon));
      if (matchedCoupon) {
        const base = resolveBase(matchedCoupon.applyBase, {
          subtotal: sub,
          afterDiscount,
          afterShipping: afterDiscount,
        });
        const rawAmt = computeAmount(matchedCoupon, base);
        if (rawAmt > 0) {
          const amt = -Math.abs(rawAmt);
          discountTotal = roundMoney(discountTotal + Math.abs(amt));
          afterDiscount = roundMoney(Math.max(0, sub - discountTotal));
          appliedCouponCode = enteredCoupon;
          lines.push({
            ruleId: matchedCoupon.id,
            label: matchedCoupon.label,
            category: 'discount',
            amount: amt,
          });
        }
      }
    }
  }

  // —— Shipping (waived when free shipping applies; packing still charged) ——
  const shippingRules = enabledRules.filter(
    (r) =>
      r.type !== 'free_shipping_above' &&
      r.type !== 'cod_charge' &&
      !isTaxRule(r) &&
      !isAutoDiscountRule(r) &&
      !isCouponRule(r) &&
      !(r.type === 'custom' && r.category === 'discount') &&
      (isShippingChargeRule(r) || (r.type === 'custom' && r.category === 'shipping')) &&
      ruleMatchesPayment(r, paymentMethod) &&
      ruleMatchesSubtotal(r, sub)
  );

  for (const rule of shippingRules) {
    const waivable =
      rule.type === 'flat_shipping' || rule.type === 'percent_shipping';
    if (freeShippingApplied && waivable) continue;

    const base = resolveBase(rule.applyBase, {
      subtotal: sub,
      afterDiscount,
      afterShipping: afterDiscount,
    });
    const amt = computeAmount(rule, base);
    if (amt <= 0) continue;
    shippingTotal += amt;
    lines.push({ ruleId: rule.id, label: rule.label, category: 'shipping', amount: amt });
  }

  shippingTotal = roundMoney(shippingTotal);
  const afterShipping = roundMoney(afterDiscount + shippingTotal);

  // —— Taxes ——
  const taxRules = enabledRules.filter(
    (r) =>
      (isTaxRule(r) || (r.type === 'custom' && r.category === 'tax')) &&
      ruleMatchesPayment(r, paymentMethod) &&
      ruleMatchesSubtotal(r, sub)
  );

  for (const rule of taxRules) {
    const base = resolveBase(rule.applyBase, {
      subtotal: sub,
      afterDiscount,
      afterShipping,
    });
    const amt = computeAmount(rule, base);
    if (amt <= 0) continue;
    taxTotal += amt;
    lines.push({ ruleId: rule.id, label: rule.label, category: 'tax', amount: amt });
  }

  taxTotal = roundMoney(taxTotal);

  // —— COD charges ——
  if (paymentMethod === 'cod') {
    const codRules = enabledRules.filter(
      (r) =>
        isCodRule(r) &&
        ruleMatchesSubtotal(r, sub)
    );
    for (const rule of codRules) {
      const base = resolveBase(rule.applyBase, {
        subtotal: sub,
        afterDiscount,
        afterShipping,
      });
      const amt = computeAmount(rule, base);
      if (amt <= 0) continue;
      codTotal += amt;
      lines.push({ ruleId: rule.id, label: rule.label, category: 'shipping', amount: amt });
    }
  }

  codTotal = roundMoney(codTotal);
  const grandTotal = roundMoney(Math.max(0, afterShipping + taxTotal + codTotal));

  return {
    subtotal: sub,
    discountTotal,
    shippingTotal: roundMoney(shippingTotal + codTotal),
    taxTotal,
    codTotal,
    grandTotal,
    lines,
    freeShippingApplied,
    appliedCouponCode,
  };
}
