import { ReactNode } from 'react';
import { STORE_SECTION_DESCRIPTION, STORE_SECTION_TITLE } from '../storeTypography';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

const getIconForTitle = (title: string): string => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('status')) return '🏪';
  if (titleLower.includes('brand')) return '✨';
  if (titleLower.includes('contact')) return '📞';
  if (titleLower.includes('social')) return '🌐';
  if (titleLower.includes('notification')) return '🔔';
  if (titleLower.includes('payment')) return '💳';
  if (titleLower.includes('shipping')) return '📦';
  if (titleLower.includes('tax')) return '📋';
  return '⚙️';
};

export default function SettingsCard({
  title,
  description,
  children,
  className = '',
}: SettingsCardProps) {
  const icon = title ? getIconForTitle(title) : null;
  const colors = [
    'from-blue-50 to-cyan-50/50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800/50',
    'from-purple-50 to-pink-50/50 dark:from-purple-950/40 dark:to-pink-950/40 border-purple-200 dark:border-purple-800/50',
    'from-green-50 to-emerald-50/50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-800/50',
    'from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/40 border-amber-200 dark:border-amber-800/50',
    'from-indigo-50 to-blue-50/50 dark:from-indigo-950/40 dark:to-blue-950/40 border-indigo-200 dark:border-indigo-800/50',
  ];

  const colorIndex = title ? title.charCodeAt(0) % colors.length : 0;
  const bgColor = colors[colorIndex];

  return (
    <section className={`bg-gradient-to-br ${bgColor} rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 border ${className}`}>
      <div className="p-4 sm:p-5">
        {title ? (
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-grow">
              <h2 className={STORE_SECTION_TITLE}>{title}</h2>
              {description ? <p className={STORE_SECTION_DESCRIPTION}>{description}</p> : null}
            </div>
          </div>
        ) : null}
        <div className={title || description ? 'mt-4 sm:mt-5' : ''}>{children}</div>
      </div>
    </section>
  );
}
