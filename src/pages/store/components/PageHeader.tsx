import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { STORE_PAGE_DESCRIPTION, STORE_PAGE_TITLE } from '../storeTypography';

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
      className={`mb-5 sm:mb-6 ${sticky ? 'sticky top-0 z-20 -mx-4 px-4 py-2.5 sm:-mx-6 sm:px-6 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200/80 dark:border-gray-800/80' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBackButton && (
            <button
              onClick={() => navigate(backTo)}
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              aria-label="Go back"
            >
              <FiArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className={STORE_PAGE_TITLE}>{title}</h1>
            {description ? <p className={STORE_PAGE_DESCRIPTION}>{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex-shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
