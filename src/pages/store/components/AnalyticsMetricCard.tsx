import type { AnalyticsMetric } from '../types/analytics';
import StoreIconTile from './StoreIconTile';

interface AnalyticsMetricCardProps {
  metric: AnalyticsMetric;
  loading?: boolean;
}

export default function AnalyticsMetricCard({ metric, loading }: AnalyticsMetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm animate-pulse">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
        <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {metric.value}
          </p>
          {metric.change ? (
            <p
              className={`mt-1.5 text-xs font-semibold ${
                metric.trend === 'up'
                  ? 'text-green-600 dark:text-green-400'
                  : metric.trend === 'down'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '•'} {metric.change}
            </p>
          ) : null}
        </div>
        {metric.iconKey ? (
          <StoreIconTile iconKey={metric.iconKey} size="md" />
        ) : null}
      </div>
    </article>
  );
}
