import { useState, useRef, useEffect } from 'react';
import { FiInfo } from 'react-icons/fi';

interface InfoTooltipProps {
  content: string;
  className?: string;
}

export function InfoTooltip({ content, className = '' }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0"
        aria-label="Information"
      >
        <FiInfo size={14} />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="absolute z-50 p-3 mt-2 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md dark:shadow-xl whitespace-normal w-56 leading-relaxed"
          style={{ left: '0' }}
        >
          <div className="absolute -top-1 left-1 w-2 h-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-b-0 border-r-0 transform -rotate-45" />
          {content}
        </div>
      )}
    </div>
  );
}
