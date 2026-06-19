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
      className={`mb-5 sm:mb-6 ${sticky ? 'sticky top-0 z-20 -mx-4 px-4 py-2.5 sm:-mx-6 sm:px-6 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950/50 backdrop-blur border-b border-gray-100/80 dark:border-gray-800/50 shadow-sm' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBackButton && (
            <button
              onClick={() => navigate(backTo)}
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-gray-50 dark:from-blue-950/40 dark:to-gray-900 text-blue-600 dark:text-blue-400 hover:from-blue-100 hover:to-gray-100 dark:hover:from-blue-900/50 dark:hover:to-gray-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
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
