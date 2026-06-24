import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { IoLockClosed } from 'react-icons/io5';

interface ProFeatureGateProps {
  children: React.ReactNode;
  featureName: string;
  locked?: boolean;
}

/**
 * Wraps a feature and shows a lock overlay if user is not Pro
 */
export function ProFeatureGate({ children, featureName, locked = false }: ProFeatureGateProps) {
  const { isPro } = useSubscription();
  const navigate = useNavigate();

  if (isPro) return <>{children}</>;

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 bg-black/20 rounded-lg flex flex-col items-center justify-center gap-2">
        <IoLockClosed className="w-8 h-8 text-white" />
        <p className="text-white text-xs font-semibold text-center px-2">{featureName}</p>
        <button
          onClick={() => navigate('/settings/pro')}
          className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded font-semibold transition-colors"
        >
          Upgrade
        </button>
      </div>
    </div>
  );
}

interface ProLockIndicatorProps {
  show: boolean;
  onUpgrade?: () => void;
}

/**
 * Shows a small lock indicator when a specific section is locked
 */
export function ProLockIndicator({ show, onUpgrade }: ProLockIndicatorProps) {
  if (!show) return null;

  return (
    <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 rounded-lg">
      <IoLockClosed className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Pro only</span>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="ml-1 text-xs underline text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}
