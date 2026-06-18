import type { AnalyticsDateRange } from '../types/analytics';

export const ANALYTICS_DATE_RANGES: { id: AnalyticsDateRange; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'lifetime', label: 'Lifetime' },
];
