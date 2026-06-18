import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import MainAppBottomNav from '../../../components/MainAppBottomNav';
import { FiEye, FiExternalLink } from 'react-icons/fi';

/** Matches legacy store / orders status bar height. */
export const STORE_STATUS_BAR_HEIGHT_PX = 40;

interface StoreLayoutProps {
  children: ReactNode;
  storeUrl?: string;
}

export function StoreStatusBar() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-[40px] bg-[#0F172A]"
      aria-hidden
    />
  );
}

export default function StoreLayout({ children, storeUrl }: StoreLayoutProps) {
  const navigate = useNavigate();

  return (
    <>
      <StoreStatusBar />

      <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <main
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-[40px] pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>

        {storeUrl ? (
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:hidden left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-3 space-y-2 z-40">
            <button
              onClick={() => window.open(`https://${storeUrl}`, '_blank')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl active:scale-[0.99] active:bg-blue-700 transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              <FiExternalLink className="h-4 w-4" />
              Open Store
            </button>
            <button
              onClick={() => navigate('/store/homepage')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl active:scale-[0.99] active:bg-gray-50 dark:active:bg-gray-800 transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              <FiEye className="h-4 w-4" />
              Edit Homepage
            </button>
          </div>
        ) : null}

        <MainAppBottomNav active="store" />
      </div>
    </>
  );
}
