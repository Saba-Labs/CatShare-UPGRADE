import { ReactNode } from 'react';

interface MetricProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

function MetricItem({ label, value, icon, trend, trendValue }: MetricProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-xl">{icon}</span>}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl md:text-3xl font-bold text-gray-900">{value}</span>
        {trend && trendValue && (
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
        )}
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[...Array(6)].map((_, i) => (
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Store Health</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {metrics.map((metric, index) => (
          <MetricItem key={index} {...metric} />
        ))}
      </div>
    </div>
  );
}
