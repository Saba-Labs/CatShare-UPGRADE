import { ReactNode } from 'react';

interface QuickActionButtonProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export default function QuickActionButton({
  icon,
  title,
  description,
  onClick,
  variant = 'secondary',
}: QuickActionButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 min-h-[132px] ${
        isPrimary
          ? 'bg-blue-600 text-white shadow-sm hover:shadow-md hover:bg-blue-700'
          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5'
      }`}
    >
      <div
        className={`text-3xl sm:text-4xl mb-3 transition-transform group-hover:scale-105 ${
          isPrimary ? 'text-white' : 'text-blue-600'
        }`}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-sm md:text-base mb-1">{title}</h3>
      <p
        className={`text-xs ${isPrimary ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}
      >
        {description}
      </p>
    </button>
  );
}
