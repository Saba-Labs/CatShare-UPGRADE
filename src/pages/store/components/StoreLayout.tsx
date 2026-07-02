import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainAppBottomNav from '../../../components/MainAppBottomNav';
import SupportWhatsAppFab from '../../../components/SupportWhatsAppFab';

/** Matches legacy store / orders status bar height. */
export const STORE_STATUS_BAR_HEIGHT_PX = 40;

/** Scroll padding so content clears the fixed main app bottom tab bar. */
export const STORE_SCROLL_BOTTOM_PADDING_CLASS =
  'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]';

/** Extra scroll padding when a fixed save bar is shown above the tab bar. */
export const STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS =
  'pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]';

/** Root wrapper class for all `/store/*` admin pages — compact in-app typography. */
export const STORE_SHELL_CLASS = 'store-admin text-sm text-gray-900 dark:text-gray-100 antialiased';

interface StoreLayoutProps {
  children: ReactNode;
  storeUrl?: string;
  /** Child fills the viewport below the status bar (e.g. homepage builder). */
  immersive?: boolean;
  /** Hide main app bottom tab bar (e.g. full-screen homepage builder). */
  hideBottomNav?: boolean;
}

export function StoreStatusBar() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-[40px] bg-[#0F172A]"
      aria-hidden
    />
  );
}

export default function StoreLayout({
  children,
  storeUrl,
  immersive = false,
  hideBottomNav = false,
}: StoreLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMainStorePage = location.pathname === '/store';
  const fullscreenChrome = immersive && hideBottomNav;

  return (
    <>
      <StoreStatusBar />

      <div className={`flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 ${STORE_SHELL_CLASS}`}>
        <main
          className={`flex-1 min-h-0 pt-[40px] ${
            immersive
              ? `flex flex-col overflow-hidden${hideBottomNav ? '' : ` ${STORE_SCROLL_BOTTOM_PADDING_CLASS}`}`
              : `overflow-y-auto overscroll-contain ${STORE_SCROLL_BOTTOM_PADDING_CLASS}`
          }`}
        >
          <div
            className={
              fullscreenChrome
                ? 'flex min-h-0 flex-1 flex-col h-full w-full'
                : `max-w-7xl mx-auto px-4 sm:px-6 ${
                    immersive
                      ? 'flex min-h-0 flex-1 flex-col pb-4 sm:pb-5'
                      : isMainStorePage
                        ? 'py-4 sm:py-5'
                        : 'pb-4 sm:pb-5'
                  }`
            }
          >
            {children}
          </div>
        </main>


        {!hideBottomNav ? <MainAppBottomNav active="store" /> : null}
        {isMainStorePage && <SupportWhatsAppFab />}
      </div>
    </>
  );
}
