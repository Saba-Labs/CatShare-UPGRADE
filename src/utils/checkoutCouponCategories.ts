import type { CheckoutRule } from '../types/checkoutSettings';
import {
  isCategoryCouponRuleType,
  isCouponRuleExpired,
  isCouponRuleType,
  isProductCouponRuleType,
} from '../types/checkoutSettings';

export type CheckoutCartLine = {
  productId?: string;
  rowTotal: number;
  categories: string[];
};

export function normalizeRuleAllowedCategories(rule: CheckoutRule): string[] {
  const raw = rule.allowedCategories;
  if (!raw || !Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((c) => String(c).trim()).filter(Boolean)));
}

export function normalizeRuleAllowedProducts(rule: CheckoutRule): string[] {
  const raw = rule.allowedProductIds;
  if (!raw || !Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((id) => String(id).trim()).filter(Boolean)));
}

export function ruleHasCategoryRestriction(rule: CheckoutRule): boolean {
  return isCategoryCouponRuleType(rule.type) && normalizeRuleAllowedCategories(rule).length > 0;
}

export function ruleHasProductRestriction(rule: CheckoutRule): boolean {
  return isProductCouponRuleType(rule.type) && normalizeRuleAllowedProducts(rule).length > 0;
}

export function lineMatchesAllowedCategories(lineCategories: string[], allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const normalized = lineCategories.map((c) => c.trim()).filter(Boolean);
  return normalized.some((c) => allowed.includes(c));
}

export function lineMatchesAllowedProducts(productId: string | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const id = String(productId ?? '').trim();
  return id.length > 0 && allowed.includes(id);
}

export function eligibleCategorySubtotal(lines: CheckoutCartLine[], allowed: string[]): number {
  if (allowed.length === 0) {
    return lines.reduce((sum, line) => sum + line.rowTotal, 0);
  }
  return lines
    .filter((line) => lineMatchesAllowedCategories(line.categories, allowed))
    .reduce((sum, line) => sum + line.rowTotal, 0);
}

export function eligibleProductSubtotal(lines: CheckoutCartLine[], allowed: string[]): number {
  if (allowed.length === 0) {
    return lines.reduce((sum, line) => sum + line.rowTotal, 0);
  }
  return lines
    .filter((line) => lineMatchesAllowedProducts(line.productId, allowed))
    .reduce((sum, line) => sum + line.rowTotal, 0);
}

export function getCouponEligibleSubtotal(
  rule: CheckoutRule,
  lines: CheckoutCartLine[],
  orderSubtotal: number
): number {
  if (isCategoryCouponRuleType(rule.type)) {
    return eligibleCategorySubtotal(lines, normalizeRuleAllowedCategories(rule));
  }
  if (isProductCouponRuleType(rule.type)) {
    return eligibleProductSubtotal(lines, normalizeRuleAllowedProducts(rule));
  }
  return orderSubtotal;
}

export function cartHasEligibleCategoryItems(lines: CheckoutCartLine[], allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return eligibleCategorySubtotal(lines, allowed) > 0;
}

export function cartHasEligibleProductItems(lines: CheckoutCartLine[], allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return eligibleProductSubtotal(lines, allowed) > 0;
}

export function formatCategoryRestrictionSummary(allowed: string[]): string | null {
  if (allowed.length === 0) return null;
  if (allowed.length <= 2) return allowed.join(', ');
  return `${allowed.slice(0, 2).join(', ')} +${allowed.length - 2}`;
}

export function formatProductRestrictionSummary(
  allowedIds: string[],
  nameById?: Map<string, string>
): string | null {
  if (allowedIds.length === 0) return null;
  if (nameById) {
    const names = allowedIds
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name?.trim()));
    if (names.length > 0) {
      if (names.length <= 2) return names.join(', ');
      return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    }
  }
  return `${allowedIds.length} product${allowedIds.length === 1 ? '' : 's'}`;
}

export function getCategoryMismatchMessage(allowed: string[]): string {
  const summary = formatCategoryRestrictionSummary(allowed);
  return summary
    ? `This coupon applies only to ${summary} items.`
    : 'This coupon does not apply to items in your cart.';
}

export function getProductMismatchMessage(
  allowedIds: string[],
  nameById?: Map<string, string>
): string {
  const summary = formatProductRestrictionSummary(allowedIds, nameById);
  return summary
    ? `This coupon applies only to ${summary}.`
    : 'This coupon does not apply to items in your cart.';
}

export function findMatchingCouponRule(
  rules: CheckoutRule[],
  couponCode: string
): CheckoutRule | undefined {
  const entered = String(couponCode ?? '').trim().toUpperCase();
  if (!entered) return undefined;
  return rules.find(
    (rule) =>
      rule.enabled &&
      !isCouponRuleExpired(rule) &&
      isCouponRuleType(rule.type) &&
      String(rule.code ?? '').trim().toUpperCase() === entered
  );
}

export type CouponRestrictionReason = 'category_mismatch' | 'product_mismatch';

export function evaluateCouponCategoryRestriction(
  rule: CheckoutRule | undefined,
  cartLines: CheckoutCartLine[] | undefined
): 'category_mismatch' | null {
  if (!rule || !isCategoryCouponRuleType(rule.type)) return null;
  const allowed = normalizeRuleAllowedCategories(rule);
  if (allowed.length === 0) return 'category_mismatch';
  if (!cartLines?.length) return 'category_mismatch';
  return cartHasEligibleCategoryItems(cartLines, allowed) ? null : 'category_mismatch';
}

export function evaluateCouponProductRestriction(
  rule: CheckoutRule | undefined,
  cartLines: CheckoutCartLine[] | undefined
): 'product_mismatch' | null {
  if (!rule || !isProductCouponRuleType(rule.type)) return null;
  const allowed = normalizeRuleAllowedProducts(rule);
  if (allowed.length === 0) return 'product_mismatch';
  if (!cartLines?.length) return 'product_mismatch';
  return cartHasEligibleProductItems(cartLines, allowed) ? null : 'product_mismatch';
}

export function evaluateCouponItemRestriction(
  rule: CheckoutRule | undefined,
  cartLines: CheckoutCartLine[] | undefined
): CouponRestrictionReason | null {
  return (
    evaluateCouponCategoryRestriction(rule, cartLines) ??
    evaluateCouponProductRestriction(rule, cartLines)
  );
}
