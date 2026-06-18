import { ReactNode } from 'react';

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
      <div className="p-4 sm:p-6">
        {title && <h2 className="text-xs font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>}
        {description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}
