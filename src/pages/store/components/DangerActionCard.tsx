import type { ReactNode } from 'react';
import { FiChevronRight } from 'react-icons/fi';

interface DangerActionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

export default function DangerActionCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  disabled = false,
}: DangerActionCardProps) {
  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-red-900 dark:text-red-100">{title}</h3>
            <p className="mt-1.5 text-sm text-red-800/80 dark:text-red-200/70 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 w-full sm:w-auto"
        >
          {actionLabel}
          <FiChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
