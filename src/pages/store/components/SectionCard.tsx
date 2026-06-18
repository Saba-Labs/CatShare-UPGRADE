import { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({
  title,
  subtitle,
  icon,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 ${className}`}>
      {(title || icon) && (
        <div className="flex items-start gap-3 mb-4">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex-1">
            {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
