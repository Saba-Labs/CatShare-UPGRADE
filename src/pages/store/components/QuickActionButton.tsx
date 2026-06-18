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
      className={`flex flex-col items-center text-center p-6 rounded-xl transition-all active:scale-95 ${
        isPrimary
          ? 'bg-blue-600 text-white shadow-lg hover:shadow-xl hover:bg-blue-700'
          : 'bg-white border border-gray-200 text-gray-900 shadow-sm hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div
        className={`text-4xl mb-3 ${
          isPrimary ? 'text-white' : 'text-blue-600'
        }`}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-sm md:text-base mb-1">{title}</h3>
      <p
        className={`text-xs ${isPrimary ? 'text-blue-100' : 'text-gray-600'}`}
      >
        {description}
      </p>
    </button>
  );
}
