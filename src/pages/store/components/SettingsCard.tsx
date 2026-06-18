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
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div className="p-6">
        {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
