import type { AnalyticsBreakdownRow } from '../types/analytics';

interface AnalyticsBreakdownListProps {
  title: string;
  rows: AnalyticsBreakdownRow[];
  loading?: boolean;
}

export default function AnalyticsBreakdownList({ title, rows, loading }: AnalyticsBreakdownListProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm animate-pulse space-y-3">
        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 rounded bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No data available yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.label}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {row.value} <span className="text-gray-400 dark:text-gray-500">({row.share}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                style={{ width: `${row.share}%` }}
              />
            </div>
          </div>
          ))}
        </div>
      )}
    </div>
  );
}
