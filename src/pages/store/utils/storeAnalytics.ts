import type { Order } from '../../../services/orderService';
import type {
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
  iconKey: StoreIconKey
): AnalyticsMetric {
  return { id, label, value, iconKey };
}

export function computeAnalyticsFromOrders(
  orders: Order[],
  range: AnalyticsDateRange
): AnalyticsDashboardData {
  const filtered = filterOrdersByRange(orders, range);
  const completed = filtered.filter((order) => order.status === 'completed');
  const currency = completed[0]?.currency_code || filtered[0]?.currency_code || 'INR';
  const sym = currencySymbol(currency);
  const revenue = completed.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const pendingCount = filtered.filter((order) => order.status === 'pending').length;
  const aov = completed.length > 0 ? revenue / completed.length : 0;

  const customerCounts = new Map<string, number>();
  for (const order of filtered) {
    const key = (order.customer_whatsapp || order.customer_name || order.id).trim().toLowerCase();
    customerCounts.set(key, (customerCounts.get(key) || 0) + 1);
  }
  const returningCustomers = [...customerCounts.values()].filter((count) => count > 1).length;

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
    .slice(0, 5)
    .map(([id, row]) => ({
      id,
      name: row.name,
      orders: row.orders,
      revenue: formatMoney(row.revenue, sym),
    }));

  return {
    range,
    rangeLabel: RANGE_LABELS[range],
    metrics: {
      visitors: metric('visitors', 'Store Orders', String(filtered.length), 'orders'),
      orders: metric('orders', 'Completed Orders', String(completed.length), 'orders'),
      revenue: metric('revenue', 'Revenue', formatMoney(revenue, sym), 'revenue'),
      conversionRate: metric('conversion', 'Pending Orders', String(pendingCount), 'pending'),
      returningCustomers: metric(
        'returning',
        'Returning Customers',
        String(returningCustomers),
        'returning'
      ),
      averageOrderValue: metric(
        'aov',
        'Average Order Value',
        completed.length > 0 ? formatMoney(aov, sym) : '—',
        'aov'
      ),
    },
    popularProducts,
    trafficSources: [],
    deviceTypes: [],
    chartBars: buildChartBars(filtered, range),
    chartLabels: buildChartLabels(range),
  };
}

function buildChartBars(orders: Order[], range: AnalyticsDateRange): number[] {
  const completed = orders.filter((order) => order.status === 'completed');
  if (range === 'week') {
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

  if (range === 'month') {
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

function buildChartLabels(range: AnalyticsDateRange): string[] {
  if (range === 'week') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (range === 'month') return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
  return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
}

export function hasAnalyticsData(data: AnalyticsDashboardData): boolean {
  return (
    Number(data.metrics.orders.value) > 0 ||
    data.popularProducts.length > 0 ||
    Number(data.metrics.conversionRate.value) > 0
  );
}
