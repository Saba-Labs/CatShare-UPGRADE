import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { IoLockClosed } from 'react-icons/io5';
import { FiArrowRight } from 'react-icons/fi';

interface ProFeatureGateProps {
  children: React.ReactNode;
  featureName: string;
  locked?: boolean;
}

/**
 * Wraps a feature and shows a modern lock overlay if user is not Pro
 */
export function ProFeatureGate({ children, featureName, locked = false }: ProFeatureGateProps) {
  const { isPro, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) return <>{children}</>;
  if (isPro) return <>{children}</>;

  return (
    <div className="relative">
      <div className="opacity-75 pointer-events-none select-none">
        {children}
      </div>
      <div className="fixed top-[40px] inset-x-0 bottom-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-md w-full mx-4 p-8 text-center pointer-events-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 mb-6">
            <IoLockClosed className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{featureName}</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">
            This feature is exclusive to Pro members. Upgrade your account to unlock it.
          </p>

          <button
            onClick={() => navigate('/settings/pro')}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
          >
            Upgrade to Pro
            <FiArrowRight className="w-5 h-5" />
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-500 mt-6">
            Pro members get access to premium features and priority support.
          </p>
        </div>
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
