import { ReactNode } from 'react';
import { STORE_SECTION_DESCRIPTION, STORE_SECTION_TITLE } from '../storeTypography';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

const getColorScheme = (title: string): { bg: string; accent: string; border: string } => {
  const titleLower = title.toLowerCase();
  const index = titleLower.charCodeAt(0) % 5;

  const schemes = [
    {
      bg: 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 dark:from-blue-950/20 dark:via-gray-900/40 dark:to-blue-950/10',
      accent: 'from-blue-600 to-blue-500',
      border: 'border-blue-200 dark:border-blue-800/40',
    },
    {
      bg: 'bg-gradient-to-br from-purple-50/80 via-white to-purple-50/40 dark:from-purple-950/20 dark:via-gray-900/40 dark:to-purple-950/10',
      accent: 'from-purple-600 to-purple-500',
      border: 'border-purple-200 dark:border-purple-800/40',
    },
    {
      bg: 'bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/20 dark:via-gray-900/40 dark:to-emerald-950/10',
      accent: 'from-emerald-600 to-emerald-500',
      border: 'border-emerald-200 dark:border-emerald-800/40',
    },
    {
      bg: 'bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 dark:from-amber-950/20 dark:via-gray-900/40 dark:to-amber-950/10',
      accent: 'from-amber-600 to-amber-500',
      border: 'border-amber-200 dark:border-amber-800/40',
    },
    {
      bg: 'bg-gradient-to-br from-rose-50/80 via-white to-rose-50/40 dark:from-rose-950/20 dark:via-gray-900/40 dark:to-rose-950/10',
      accent: 'from-rose-600 to-rose-500',
      border: 'border-rose-200 dark:border-rose-800/40',
    },
  ];

  return schemes[index];
};

export default function SettingsCard({
  title,
  description,
  children,
  className = '',
}: SettingsCardProps) {
  const { bg, accent, border } = title ? getColorScheme(title) : { bg: 'bg-white dark:bg-gray-900', accent: 'from-blue-600 to-blue-500', border: 'border-gray-200 dark:border-gray-700' };

  return (
    <section className={`${bg} border ${border} rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${className}`}>
      {title && <div className={`h-1 bg-gradient-to-r ${accent}`}></div>}
      <div className="p-4 sm:p-5">
        {title ? <h2 className={STORE_SECTION_TITLE}>{title}</h2> : null}
        {description ? <p className={STORE_SECTION_DESCRIPTION}>{description}</p> : null}
        <div className={title || description ? 'mt-4 sm:mt-5' : ''}>{children}</div>
      </div>
    </section>
  );
}
