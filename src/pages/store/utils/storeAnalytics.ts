import type { Order } from '../../../services/orderService';
import { getOrderStatusLabel, normalizeOrderStatus } from '../../../types/orderStatus';
import type {
  AnalyticsBreakdownRow,
  AnalyticsDashboardData,
  AnalyticsDateRange,
  AnalyticsMetric,
} from '../types/analytics';
import type { StoreIconKey } from '../components/StoreIconTile';

const RANGE_LABELS: Record<AnalyticsDateRange, string> = {
  week: 'Last 7 days',
  month: 'Last 30 days',
  year: 'Last 12 months',
  lifetime: 'All time',
};

const ORDER_SOURCE_LABELS: Record<string, string> = {
  store: 'Storefront',
  link: 'Order link',
  manual: 'Manual entry',
  unknown: 'Other',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  prepaid: 'Online / prepaid',
  cod: 'Cash on delivery',
  upi: 'UPI',
  manual: 'Manual / offline',
  unknown: 'Not specified',
};

function getRangeStart(range: AnalyticsDateRange): Date | null {
  if (range === 'lifetime') return null;
  const start = new Date();
  if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'month') start.setDate(start.getDate() - 30);
  else start.setFullYear(start.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function filterOrdersByRange(orders: Order[], range: AnalyticsDateRange): Order[] {
  const start = getRangeStart(range);
  if (!start) return orders;
  return orders.filter((order) => new Date(order.created_at) >= start);
}

function filterPreviousPeriodOrders(orders: Order[], range: AnalyticsDateRange): Order[] {
  const start = getRangeStart(range);
  if (!start) return [];
  const durationMs = Date.now() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return orders.filter((order) => {
    const created = new Date(order.created_at).getTime();
    return created >= prevStart.getTime() && created <= prevEnd.getTime();
  });
}

function currencySymbol(code?: string): string {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return '₹';
}

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function metric(
  id: string,
  label: string,
  value: string,
  iconKey: StoreIconKey,
  change?: string,
  trend?: AnalyticsMetric['trend']
): AnalyticsMetric {
  return { id, label, value, iconKey, change, trend };
}

function periodTrend(
  current: number,
  previous: number,
  dateRange: AnalyticsDateRange
): Pick<AnalyticsMetric, 'change' | 'trend'> | undefined {
  if (dateRange === 'lifetime') return undefined;
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { change: 'Up from prior period', trend: 'up' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { change: 'Same as prior period', trend: 'stable' };
  return {
    change: `${pct > 0 ? '+' : ''}${pct}% vs prior period`,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable',
  };
}

function buildBreakdown(
  counts: Map<string, number>,
  labels: Record<string, string>
): AnalyticsBreakdownRow[] {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      label: labels[id] ?? id,
      value: String(count),
      share: Math.round((count / total) * 100),
    }));
}

function customerKey(order: Order): string {
  return (order.customer_whatsapp || order.customer_name || order.id).trim().toLowerCase();
}

export function computeAnalyticsFromOrders(
  orders: Order[],
  dateRange: AnalyticsDateRange
): AnalyticsDashboardData {
  const filtered = filterOrdersByRange(orders, dateRange);
  const previous = filterPreviousPeriodOrders(orders, dateRange);

  const completed = filtered.filter((order) => normalizeOrderStatus(order.status) === 'completed');
  const prevCompleted = previous.filter((order) => normalizeOrderStatus(order.status) === 'completed');

  const currency = completed[0]?.currency_code || filtered[0]?.currency_code || 'INR';
  const sym = currencySymbol(currency);
  const revenue = completed.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const prevRevenue = prevCompleted.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const aov = completed.length > 0 ? revenue / completed.length : 0;

  const pendingCount = filtered.filter((o) => normalizeOrderStatus(o.status) === 'pending').length;
  const processingCount = filtered.filter((o) => normalizeOrderStatus(o.status) === 'processing').length;
  const shippedCount = filtered.filter((o) => normalizeOrderStatus(o.status) === 'shipped').length;
  const cancelledCount = filtered.filter((o) => normalizeOrderStatus(o.status) === 'cancelled').length;

  const itemsSold = completed.reduce(
    (sum, order) => sum + (order.items || []).reduce((lineSum, item) => lineSum + item.quantity, 0),
    0
  );

  const customerCounts = new Map<string, number>();
  for (const order of filtered) {
    const key = customerKey(order);
    customerCounts.set(key, (customerCounts.get(key) || 0) + 1);
  }
  const uniqueCustomers = customerCounts.size;
  const returningCustomers = [...customerCounts.values()].filter((count) => count > 1).length;

  const statusCounts = new Map<string, number>();
  for (const order of filtered) {
    const status = normalizeOrderStatus(order.status);
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  const statusLabels = Object.fromEntries(
    [...statusCounts.keys()].map((key) => [key, getOrderStatusLabel(key)])
  );

  const sourceCounts = new Map<string, number>();
  for (const order of filtered) {
    const key = order.order_source || 'unknown';
    sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
  }

  const paymentCounts = new Map<string, number>();
  for (const order of filtered) {
    const key = order.payment_method || 'unknown';
    paymentCounts.set(key, (paymentCounts.get(key) || 0) + 1);
  }

  const productMap = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const order of completed) {
    for (const item of order.items || []) {
      const key = item.productId || item.name;
      const row = productMap.get(key) || { name: item.name, orders: 0, revenue: 0 };
      row.orders += item.quantity;
      row.revenue += item.rowTotal ?? item.unitPrice * item.quantity;
      productMap.set(key, row);
    }
  }

  const popularProducts = [...productMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8)
    .map(([id, row]) => ({
      id,
      name: row.name,
      orders: row.orders,
      revenue: formatMoney(row.revenue, sym),
    }));

  const revenueTrend = periodTrend(revenue, prevRevenue, dateRange);
  const ordersTrend = periodTrend(completed.length, prevCompleted.length, dateRange);

  return {
    range: dateRange,
    rangeLabel: RANGE_LABELS[dateRange],
    metrics: {
      totalOrders: metric('total', 'Total Orders', String(filtered.length), 'orders'),
      completedOrders: metric(
        'completed',
        'Completed Orders',
        String(completed.length),
        'orders',
        ordersTrend?.change,
        ordersTrend?.trend
      ),
      revenue: metric(
        'revenue',
        'Revenue',
        formatMoney(revenue, sym),
        'revenue',
        revenueTrend?.change,
        revenueTrend?.trend
      ),
      averageOrderValue: metric(
        'aov',
        'Average Order Value',
        completed.length > 0 ? formatMoney(aov, sym) : '—',
        'aov'
      ),
      itemsSold: metric('items', 'Items Sold', String(itemsSold), 'products'),
      uniqueCustomers: metric('customers', 'Unique Customers', String(uniqueCustomers), 'visitors'),
      returningCustomers: metric(
        'returning',
        'Returning Customers',
        String(returningCustomers),
        'returning'
      ),
      activePipeline: metric(
        'pipeline',
        'Pending · Processing',
        `${pendingCount} · ${processingCount}`,
        'pending'
      ),
      shippedOrders: metric('shipped', 'Shipped Orders', String(shippedCount), 'shipping'),
      cancelledOrders: metric('cancelled', 'Cancelled Orders', String(cancelledCount), 'danger'),
    },
    popularProducts,
    orderStatusBreakdown: buildBreakdown(statusCounts, statusLabels),
    orderSourceBreakdown: buildBreakdown(sourceCounts, ORDER_SOURCE_LABELS),
    paymentMethodBreakdown: buildBreakdown(paymentCounts, PAYMENT_METHOD_LABELS),
    chartBars: buildChartBars(filtered, dateRange),
    chartLabels: buildChartLabels(dateRange),
  };
}

function buildChartBars(orders: Order[], dateRange: AnalyticsDateRange): number[] {
  const completed = orders.filter((order) => normalizeOrderStatus(order.status) === 'completed');
  if (dateRange === 'week') {
    const buckets = Array(7).fill(0);
    const start = getRangeStart('week')!;
    for (const order of completed) {
      const dayIndex = Math.floor(
        (new Date(order.created_at).getTime() - start.getTime()) / 86_400_000
      );
      if (dayIndex >= 0 && dayIndex < 7) buckets[dayIndex] += order.total_amount || 0;
    }
    return normalizeBars(buckets);
  }

  if (dateRange === 'month') {
    const buckets = Array(4).fill(0);
    const start = getRangeStart('month')!;
    for (const order of completed) {
      const weekIndex = Math.min(
        3,
        Math.floor((new Date(order.created_at).getTime() - start.getTime()) / (7 * 86_400_000))
      );
      buckets[weekIndex] += order.total_amount || 0;
    }
    return normalizeBars(buckets);
  }

  const buckets = Array(12).fill(0);
  for (const order of completed) {
    const month = new Date(order.created_at).getMonth();
    buckets[month] += order.total_amount || 0;
  }
  return normalizeBars(buckets);
}

function normalizeBars(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((value) => Math.round((value / max) * 100));
}

function buildChartLabels(dateRange: AnalyticsDateRange): string[] {
  if (dateRange === 'week') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (dateRange === 'month') return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
  return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
}

export function hasAnalyticsData(data: AnalyticsDashboardData): boolean {
  return (
    Number(data.metrics.totalOrders.value) > 0 ||
    data.popularProducts.length > 0
  );
}
