import { ANALYTICS_DATE_RANGES } from '../config/analyticsPlaceholders';
import type { AnalyticsDateRange } from '../types/analytics';

interface AnalyticsDateFilterProps {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
  disabled?: boolean;
}

export default function AnalyticsDateFilter({ value, onChange, disabled }: AnalyticsDateFilterProps) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100/80 dark:bg-gray-900/80 p-1"
      role="tablist"
      aria-label="Date range"
    >
      {ANALYTICS_DATE_RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          role="tab"
          aria-selected={value === range.id}
          disabled={disabled}
          onClick={() => onChange(range.id)}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50 ${
            value === range.id
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
