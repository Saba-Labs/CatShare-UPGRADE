import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import MainAppBottomNav from '../../../components/MainAppBottomNav';

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


        <MainAppBottomNav active="store" />
      </div>
    </>
  );
}
