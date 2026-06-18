import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

interface PageHeaderProps {
  title: string;
  description?: string;
  showBackButton?: boolean;
  backTo?: string;
  actions?: ReactNode;
  sticky?: boolean;
}

export default function PageHeader({
  title,
  description,
  showBackButton = true,
  backTo = '/store',
  actions,
  sticky = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`mb-6 sm:mb-8 ${sticky ? 'sticky top-0 z-20 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200/80 dark:border-gray-800/80' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {showBackButton && (
            <button
              onClick={() => navigate(backTo)}
              className="mb-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              aria-label="Go back"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
          {description && <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl">{description}</p>}
        </div>
        {actions && <div className="flex-shrink-0 pt-0.5">{actions}</div>}
      </div>
    </div>
  );
}
