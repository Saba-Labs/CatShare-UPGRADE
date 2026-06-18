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
    <section className={`bg-gray-50/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-6 ${className}`}>
      {(title || icon) && (
        <div className="flex items-start gap-3 mb-4">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex-1">
            {title && <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
          </div>
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
