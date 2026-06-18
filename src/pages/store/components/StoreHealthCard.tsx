import type { ReactNode } from 'react';
import { STORE_METRIC_VALUE, STORE_SECTION_TITLE } from '../storeTypography';
import StoreIconTile, { type StoreIconKey } from './StoreIconTile';

interface MetricProps {
  label: string;
  value: string | number;
  iconKey?: StoreIconKey;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

function MetricItem({ label, value, iconKey, icon, trend, trendValue }: MetricProps) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/70 p-3">
      <div className="flex items-center gap-2 mb-1">
        {iconKey ? <StoreIconTile iconKey={iconKey} size="sm" /> : icon}
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={STORE_METRIC_VALUE}>{value}</span>
        {trend && trendValue ? (
          <span
            className={`text-xs font-semibold ${
              trend === 'up'
                ? 'text-green-600'
                : trend === 'down'
                  ? 'text-red-600'
                  : 'text-gray-500'
            }`}
          >
            {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trendValue}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface StoreHealthCardProps {
  metrics: MetricProps[];
  isLoading?: boolean;
}

export default function StoreHealthCard({ metrics, isLoading = false }: StoreHealthCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                <div className="h-8 w-20 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 sm:p-5 mb-6">
      <h2 className={`${STORE_SECTION_TITLE} mb-4`}>Store Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricItem key={index} {...metric} />
        ))}
      </div>
    </div>
  );
}
