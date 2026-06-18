interface AnalyticsSalesChartProps {
  rangeLabel: string;
  bars: number[];
  labels: string[];
  empty?: boolean;
}

export default function AnalyticsSalesChart({
  rangeLabel,
  bars,
  labels,
  empty = false,
}: AnalyticsSalesChartProps) {
  if (empty || bars.every((bar) => bar === 0)) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Sales Overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 px-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No sales data for this period yet. Completed orders will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Sales Overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 px-1" aria-hidden>
        {bars.map((height, index) => (
          <div key={`${rangeLabel}-${index}`} className="flex flex-1 flex-col items-center gap-2 min-w-0">
            <div
              className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 transition-all duration-300"
              style={{ height: `${Math.max(height, 4)}%` }}
            />
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">
              {labels[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
