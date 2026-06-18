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
    <section className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm ${className}`}>
      <div className="p-4 sm:p-5">
        {title ? <h2 className={STORE_SECTION_TITLE}>{title}</h2> : null}
        {description ? <p className={STORE_SECTION_DESCRIPTION}>{description}</p> : null}
        <div className={title || description ? 'mt-3 sm:mt-4' : ''}>{children}</div>
      </div>
    </section>
  );
}
