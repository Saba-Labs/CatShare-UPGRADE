import { STORE_SECTION_TITLE, STORE_BODY } from '../storeTypography';

interface StorePlaceholderPanelProps {
  title: string;
  description: string;
  badge?: string;
  tone?: 'default' | 'danger';
}

export default function StorePlaceholderPanel({
  title,
  description,
  badge = 'In Progress',
  tone = 'default',
}: StorePlaceholderPanelProps) {
  const isDanger = tone === 'danger';

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${
      isDanger
        ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
        : 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
    }`}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          isDanger
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        }`}>
          <FiClock className="h-3.5 w-3.5" />
          {badge}
        </span>
        <h3 className={STORE_SECTION_TITLE}>{title}</h3>
      </div>
      <p className={STORE_BODY}>{description}</p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-16 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 animate-pulse"
            aria-hidden
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed"
        >
          <FiLoader className="h-4 w-4" />
          Loading section
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <FiRefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
