import type { StoreIconKey } from '../components/StoreIconTile';

export type AnalyticsDateRange = 'week' | 'month' | 'year' | 'lifetime';

export interface AnalyticsMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  iconKey?: StoreIconKey;
}

export interface AnalyticsProductRow {
  id: string;
  name: string;
  orders: number;
  revenue: string;
}

export interface AnalyticsBreakdownRow {
  id: string;
  label: string;
  value: string;
  share: number;
}

export interface AnalyticsDashboardData {
  range: AnalyticsDateRange;
  rangeLabel: string;
  metrics: {
    visitors: AnalyticsMetric;
    orders: AnalyticsMetric;
    revenue: AnalyticsMetric;
    conversionRate: AnalyticsMetric;
    returningCustomers: AnalyticsMetric;
    averageOrderValue: AnalyticsMetric;
  };
  popularProducts: AnalyticsProductRow[];
  trafficSources: AnalyticsBreakdownRow[];
  deviceTypes: AnalyticsBreakdownRow[];
  chartBars: number[];
  chartLabels: string[];
}
