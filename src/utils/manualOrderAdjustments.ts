import type { CheckoutLineItem, CheckoutTotals } from '../types/checkoutSettings';

export type ManualOrderAdjustmentKind = 'discount' | 'charge' | 'round_off';
export type ManualOrderAdjustmentAmountKind = 'flat' | 'percent';

export interface ManualOrderAdjustment {
  id: string;
  kind: ManualOrderAdjustmentKind;
  label: string;
  amount: number;
  amountKind: ManualOrderAdjustmentAmountKind;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function newManualAdjustmentId(): string {
  return `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createManualAdjustment(
  kind: ManualOrderAdjustmentKind,
  amount = 0,
  amountKind: ManualOrderAdjustmentAmountKind = 'flat'
): ManualOrderAdjustment {
  const labels: Record<ManualOrderAdjustmentKind, string> = {
    discount: 'Discount',
    charge: 'Extra charge',
    round_off: 'Round off',
  };
  return {
    id: newManualAdjustmentId(),
    kind,
    label: labels[kind],
    amount,
    amountKind: kind === 'round_off' ? 'flat' : amountKind,
  };
}

export function parseManualAdjustmentAmount(raw: string): number {
  const cleaned = String(raw).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return roundMoney(Math.abs(parsed));
}

export function computeManualCheckoutTotals(
  subtotal: number,
  adjustments: ManualOrderAdjustment[]
): CheckoutTotals {
  const sub = roundMoney(Math.max(0, subtotal));
  const lines: CheckoutLineItem[] = [];
  let discountTotal = 0;
  let shippingTotal = 0;

  for (const adjustment of adjustments) {
    const value = roundMoney(Math.abs(adjustment.amount));
    const amount =
      adjustment.amountKind === 'percent'
        ? roundMoney((sub * Math.min(value, 100)) / 100)
        : value;
    const label = adjustment.label.trim();
    if (amount <= 0 || !label) continue;

    if (adjustment.kind === 'discount' || adjustment.kind === 'round_off') {
      discountTotal += amount;
      lines.push({
        ruleId: adjustment.id,
        label,
        category: 'discount',
        amount: -amount,
      });
      continue;
    }

    shippingTotal += amount;
    lines.push({
      ruleId: adjustment.id,
      label,
      category: 'shipping',
      amount,
    });
  }

  discountTotal = roundMoney(discountTotal);
  shippingTotal = roundMoney(shippingTotal);
  const grandTotal = roundMoney(Math.max(0, sub - discountTotal + shippingTotal));

  return {
    subtotal: sub,
    discountTotal,
    shippingTotal,
    taxTotal: 0,
    codTotal: 0,
    grandTotal,
    lines,
    freeShippingApplied: false,
    appliedCouponCode: null,
  };
}

export function buildRoundOffAdjustment(
  subtotal: number,
  adjustments: ManualOrderAdjustment[]
): ManualOrderAdjustment | null {
  const withoutRoundOff = adjustments.filter((row) => row.kind !== 'round_off');
  const totals = computeManualCheckoutTotals(subtotal, withoutRoundOff);
  const diff = roundMoney(Math.round(totals.grandTotal) - totals.grandTotal);
  if (diff === 0) return null;

  return {
    id: newManualAdjustmentId(),
    kind: 'round_off',
    label: 'Round off',
    amount: Math.abs(diff),
    amountKind: 'flat',
  };
}

export function hasManualAdjustments(adjustments: ManualOrderAdjustment[]): boolean {
  return adjustments.some((row) => row.amount > 0 && row.label.trim());
}

export function manualAdjustmentsFromCheckoutTotals(
  totals: CheckoutTotals | null | undefined
): ManualOrderAdjustment[] {
  if (!totals?.lines?.length) return [];

  return totals.lines.map((line) => {
    const amount = roundMoney(Math.abs(line.amount));
    const label = line.label.trim();
    const isRoundOff = label.toLowerCase() === 'round off';
    const kind: ManualOrderAdjustmentKind =
      line.category === 'discount' || line.amount < 0
        ? isRoundOff
          ? 'round_off'
          : 'discount'
        : 'charge';

    return {
      id: line.ruleId || newManualAdjustmentId(),
      kind,
      label: label || (kind === 'charge' ? 'Extra charge' : 'Discount'),
      amount,
      amountKind: 'flat',
    };
  });
}
