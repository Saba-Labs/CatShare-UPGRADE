export const ORDER_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderTabFilter = 'all' | OrderStatus;

export function canCustomerEditOrder(status: string | null | undefined): boolean {
  return status === 'pending';
}

export function getStatusChangeLabel(status: OrderStatus): string {
  switch (status) {
    case 'confirmed':
      return '✓ Confirm';
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
  switch (status) {
    case 'completed':
      return '100%';
    case 'confirmed':
      return '66%';
    case 'pending':
      return '33%';
    default:
      return '0%';
  }
}
