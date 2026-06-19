import { ReactNode } from 'react';
import { STORE_SECTION_DESCRIPTION, STORE_SECTION_TITLE } from '../storeTypography';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function SettingsCard({
  title,
  description,
  children,
  className = '',
}: SettingsCardProps) {
  return (
    <section className={`bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950 border border-gray-100 dark:border-gray-800/50 rounded-2xl shadow-md hover:shadow-lg transition-shadow ${className}`}>
      <div className="p-4 sm:p-5">
        {title ? <h2 className={STORE_SECTION_TITLE}>{title}</h2> : null}
        {description ? <p className={STORE_SECTION_DESCRIPTION}>{description}</p> : null}
        <div className={title || description ? 'mt-3 sm:mt-4' : ''}>{children}</div>
      </div>
    </section>
  );
}
