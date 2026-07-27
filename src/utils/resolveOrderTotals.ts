import type { CheckoutTotals } from '../types/checkoutSettings';

type OrderItemLike = {
  quantity?: number;
  unitPrice?: number;
  rowTotal?: number;
};

type OrderTotalsLike = {
  total_amount?: number | null;
  checkout_adjustments?: CheckoutTotals | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumOrderItemsSubtotal(items: OrderItemLike[]): number {
  return items.reduce((sum, item) => {
    const lineTotal = item.rowTotal ?? (item.unitPrice ?? 0) * (item.quantity ?? 0);
    return sum + lineTotal;
  }, 0);
}

/** Reconcile stored totals with current line items (e.g. after customer tracking edits). */
export function resolveOrderCheckoutTotals(
  order: OrderTotalsLike,
  items: OrderItemLike[]
): { subtotal: number; grandTotal: number; checkoutAdjustments: CheckoutTotals | null | undefined } {
  const itemsSubtotal = sumOrderItemsSubtotal(items);
  const adj = order.checkout_adjustments;

  if (adj?.lines?.length) {
    const storedSubtotal = adj.subtotal ?? itemsSubtotal;
    const subtotalDrift = Math.abs(storedSubtotal - itemsSubtotal) > 0.01;
    const subtotal = subtotalDrift ? itemsSubtotal : storedSubtotal;
    const adjustmentDelta = (adj.grandTotal ?? storedSubtotal) - storedSubtotal;
    const grandTotal = roundMoney(Math.max(0, subtotal + adjustmentDelta));

    if (!subtotalDrift) {
      return { subtotal, grandTotal: adj.grandTotal ?? grandTotal, checkoutAdjustments: adj };
    }

    return {
      subtotal,
      grandTotal,
      checkoutAdjustments: { ...adj, subtotal, grandTotal },
    };
  }

  if (
    adj?.grandTotal != null &&
    order.total_amount != null &&
    Number.isFinite(order.total_amount) &&
    Math.abs(adj.grandTotal - order.total_amount) > 0.01 &&
    Math.abs(order.total_amount - itemsSubtotal) < 0.01
  ) {
    return {
      subtotal: itemsSubtotal,
      grandTotal: order.total_amount,
      checkoutAdjustments: { ...adj, subtotal: itemsSubtotal, grandTotal: order.total_amount },
    };
  }

  if (
    adj?.grandTotal != null &&
    Math.abs(adj.grandTotal - itemsSubtotal) > 0.01 &&
    (order.total_amount == null || Math.abs(order.total_amount - itemsSubtotal) < 0.01)
  ) {
    const grandTotal = order.total_amount ?? itemsSubtotal;
    return {
      subtotal: itemsSubtotal,
      grandTotal,
      checkoutAdjustments: { ...adj, subtotal: itemsSubtotal, grandTotal },
    };
  }

  const persistedTotal =
    (order.total_amount != null && Number.isFinite(order.total_amount)
      ? order.total_amount
      : null) ?? adj?.grandTotal ?? null;
  if (
    persistedTotal != null &&
    Math.abs(persistedTotal - itemsSubtotal) > 0.01 &&
    itemsSubtotal > 0
  ) {
    if (adj?.lines?.length) {
      const storedSubtotal = adj.subtotal ?? itemsSubtotal;
      const adjustmentDelta = (adj.grandTotal ?? storedSubtotal) - storedSubtotal;
      const grandTotal = roundMoney(Math.max(0, itemsSubtotal + adjustmentDelta));
      return {
        subtotal: itemsSubtotal,
        grandTotal,
        checkoutAdjustments: { ...adj, subtotal: itemsSubtotal, grandTotal },
      };
    }
    return {
      subtotal: itemsSubtotal,
      grandTotal: itemsSubtotal,
      checkoutAdjustments: adj,
    };
  }

  const grandTotal =
    (order.total_amount != null && Number.isFinite(order.total_amount)
      ? order.total_amount
      : null) ??
    adj?.grandTotal ??
    itemsSubtotal;

  const storedSubtotal = adj?.subtotal ?? itemsSubtotal;
  const subtotal =
    Math.abs(storedSubtotal - itemsSubtotal) > 0.01 ? itemsSubtotal : storedSubtotal;

  return {
    subtotal,
    grandTotal,
    checkoutAdjustments: adj,
  };
}

export function resolveOrderGrandTotal(order: OrderTotalsLike, items: OrderItemLike[]): number {
  return resolveOrderCheckoutTotals(order, items).grandTotal;
}

/** Pending payments may store a stale amount; paid amounts reflect what was collected. */
export function resolveOrderPaymentDisplayAmount(
  order: OrderTotalsLike & { items?: OrderItemLike[] },
  payment?: { amount?: number | null; status?: string } | null
): number | null {
  const items = order.items ?? [];
  const orderTotal = resolveOrderGrandTotal(order, items);
  if (!payment) return orderTotal;
  if (payment.status === 'paid' && payment.amount != null && Number.isFinite(payment.amount)) {
    return payment.amount;
  }
  return orderTotal;
}
