import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

interface NavigationCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  href: string;
  className?: string;
}

export default function NavigationCard({
  title,
  description,
  icon,
  href,
  className = '',
}: NavigationCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(href)}
      className={`group w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 md:p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${className}`}
      aria-label={`Open ${title}`}
    >
      <div className="flex items-start justify-between gap-4">
        {icon ? <div className="flex-shrink-0 mt-0.5">{icon}</div> : null}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">{title}</h3>
          {description ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
          ) : null}
        </div>
        <FiChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  );
}