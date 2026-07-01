import { getSupabaseClient } from '../supabaseClient';
import {
  evaluateCouponItemRestriction,
  findMatchingCouponRule,
  getCategoryMismatchMessage,
  getProductMismatchMessage,
  normalizeRuleAllowedCategories,
  normalizeRuleAllowedProducts,
  type CheckoutCartLine,
} from '../utils/checkoutCouponCategories';
import type { StoreCheckoutSettings } from '../types/checkoutSettings';
import {
  isCategoryCouponRuleType,
  isCouponRuleExpired,
  isProductCouponRuleType,
  normalizeCheckoutSettings,
} from '../types/checkoutSettings';

export type CouponValidationReason =
  | 'invalid_coupon'
  | 'max_uses_reached'
  | 'already_used_by_phone'
  | 'phone_required'
  | 'category_mismatch'
  | 'product_mismatch'
  | 'coupon_expired';

export interface CouponValidationResult {
  valid: boolean;
  reason?: CouponValidationReason;
}

export type CouponValidationItem = {
  productId?: string;
  category?: string;
  categories?: string[];
  rowTotal?: number;
};

export function couponValidationMessage(
  reason: CouponValidationReason | null | undefined,
  checkoutSettings?: StoreCheckoutSettings | null,
  couponCode?: string
): string {
  switch (reason) {
    case 'max_uses_reached':
      return 'This coupon has reached its usage limit.';
    case 'already_used_by_phone':
      return 'You have already used this coupon.';
    case 'phone_required':
      return 'Enter your WhatsApp number to use this coupon.';
    case 'coupon_expired':
      return 'This coupon has expired.';
    case 'category_mismatch': {
      const settings = checkoutSettings ? normalizeCheckoutSettings(checkoutSettings) : null;
      const rule = settings
        ? findMatchingCouponRule(settings.rules, couponCode ?? '')
        : undefined;
      const allowed = rule ? normalizeRuleAllowedCategories(rule) : [];
      return getCategoryMismatchMessage(allowed);
    }
    case 'product_mismatch': {
      const settings = checkoutSettings ? normalizeCheckoutSettings(checkoutSettings) : null;
      const rule = settings
        ? findMatchingCouponRule(settings.rules, couponCode ?? '')
        : undefined;
      const allowed = rule ? normalizeRuleAllowedProducts(rule) : [];
      return getProductMismatchMessage(allowed);
    }
    case 'invalid_coupon':
      return 'Code not recognized or does not apply to this order.';
    default:
      return 'Code not recognized or does not apply to this order.';
  }
}

export function evaluateCouponRestrictionBlock(
  checkoutSettings: StoreCheckoutSettings | null | undefined,
  couponCode: string,
  cartLines: CheckoutCartLine[] | undefined
): CouponValidationReason | null {
  const settings = normalizeCheckoutSettings(checkoutSettings);
  const rule = findMatchingCouponRule(settings.rules, couponCode);
  if (!rule) return null;
  if (isCouponRuleExpired(rule)) return 'coupon_expired';
  return evaluateCouponItemRestriction(rule, cartLines);
}

/** @deprecated Use evaluateCouponRestrictionBlock */
export function evaluateCouponCategoryBlock(
  checkoutSettings: StoreCheckoutSettings | null | undefined,
  couponCode: string,
  cartLines: CheckoutCartLine[] | undefined
): CouponValidationReason | null {
  return evaluateCouponRestrictionBlock(checkoutSettings, couponCode, cartLines);
}

export async function validateStorefrontCoupon(
  sellerUserId: string,
  couponCode: string,
  customerWhatsapp?: string,
  items?: CouponValidationItem[]
): Promise<CouponValidationResult> {
  const code = String(couponCode ?? '').trim();
  if (!code) {
    return { valid: true };
  }

  const seller = String(sellerUserId ?? '').trim();
  if (!seller) {
    return { valid: false, reason: 'invalid_coupon' };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('validate_storefront_coupon', {
      p_seller_user_id: seller,
      p_coupon_code: code,
      p_customer_whatsapp: customerWhatsapp?.trim() ?? '',
      p_items: items?.length ? items : null,
    });

    if (error) {
      console.warn('validate_storefront_coupon failed:', error);
      return { valid: true };
    }

    const row = data as { valid?: boolean; reason?: string } | null;
    if (!row || row.valid !== false) {
      return { valid: true };
    }

    const reason = row.reason as CouponValidationReason | undefined;
    if (
      reason === 'max_uses_reached' ||
      reason === 'already_used_by_phone' ||
      reason === 'phone_required' ||
      reason === 'invalid_coupon' ||
      reason === 'category_mismatch' ||
      reason === 'product_mismatch' ||
      reason === 'coupon_expired'
    ) {
      return { valid: false, reason };
    }

    return { valid: false, reason: 'invalid_coupon' };
  } catch (err) {
    console.warn('validate_storefront_coupon threw:', err);
    return { valid: true };
  }
}

export function isRestrictedCouponRule(
  rule: { type: string } | null | undefined
): boolean {
  if (!rule) return false;
  return isCategoryCouponRuleType(rule.type as never) || isProductCouponRuleType(rule.type as never);
}
