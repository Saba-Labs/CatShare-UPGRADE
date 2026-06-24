import type { ReactNode } from 'react';
import { STORE_CARD_TITLE, STORE_SECTION_DESCRIPTION } from '../storeTypography';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { useSubscription } from '../../../context/SubscriptionContext';
import { ProLockIndicator } from '../../../components/ProFeatureGate';

interface NavigationCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  href: string;
  proOnly?: boolean;
  className?: string;
}

export default function NavigationCard({
  title,
  description,
  icon,
  href,
  proOnly = false,
  className = '',
}: NavigationCardProps) {
  const navigate = useNavigate();
  const { isPro } = useSubscription();

  return (
    <button
      onClick={() => navigate(href)}
      className={`group w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${className}`}
      aria-label={`Open ${title}`}
    >
      <div className="flex items-center justify-between gap-4">
        {icon ? <div className="flex-shrink-0">{icon}</div> : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className={STORE_CARD_TITLE}>{title}</h3>
            {proOnly && !isPro && <ProLockIndicator show />}
          </div>
          {description ? (
            <p className={STORE_SECTION_DESCRIPTION}>{description}</p>
          ) : null}
        </div>
        <FiChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 transition-colors" />
      </div>
    </button>
  );
}
