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
      className={`w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {icon && <div className="flex-shrink-0 text-gray-400">{icon}</div>}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
          </div>
        </div>
        <FiChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
