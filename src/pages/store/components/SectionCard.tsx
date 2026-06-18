import { ReactNode } from 'react';
import { STORE_CARD_TITLE, STORE_SECTION_DESCRIPTION } from '../storeTypography';

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
    <section className={`bg-gray-50/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 ${className}`}>
      {(title || icon) && (
        <div className="flex items-start gap-3 mb-3">
          {icon ? <div className="flex-shrink-0">{icon}</div> : null}
          <div className="flex-1 min-w-0">
            {title ? <h3 className={STORE_CARD_TITLE}>{title}</h3> : null}
            {subtitle ? <p className={STORE_SECTION_DESCRIPTION}>{subtitle}</p> : null}
          </div>
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
