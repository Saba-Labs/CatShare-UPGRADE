export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderTabFilter = 'all' | OrderStatus;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Map legacy DB values and aliases to the current status key. */
export function normalizeOrderStatus(status: string | null | undefined): string {
  if (!status) return 'pending';
  if (status === 'confirmed') return 'processing';
  return status;
}

export function getOrderStatusLabel(status: string): string {
  const normalized = normalizeOrderStatus(status);
  if ((ORDER_STATUSES as readonly string[]).includes(normalized)) {
    return ORDER_STATUS_LABELS[normalized as OrderStatus];
  }
  return status;
}

export function canCustomerEditOrder(status: string | null | undefined): boolean {
  return normalizeOrderStatus(status) === 'pending';
}

export function getStatusChangeLabel(status: OrderStatus): string {
  switch (status) {
    case 'processing':
      return '✓ Processing';
    case 'shipped':
      return '🚚 Shipped';
    case 'completed':
      return '✓ Complete';
    case 'cancelled':
      return '✕ Cancel';
    case 'pending':
      return '↩ Reopen';
    default:
      return status;
  }
}

export function orderStatusProgressWidth(status: string): string {
  switch (normalizeOrderStatus(status)) {
    case 'completed':
      return '100%';
    case 'shipped':
      return '75%';
    case 'processing':
      return '50%';
    case 'pending':
      return '25%';
    default:
      return '0%';
  }
}
