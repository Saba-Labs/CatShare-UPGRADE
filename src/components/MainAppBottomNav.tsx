import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { FiPackage, FiGrid, FiShoppingCart, FiShoppingBag } from 'react-icons/fi';

export type MainAppTab = 'products' | 'catalogues' | 'orders' | 'store';

const pathForTab = (tab: MainAppTab): string => {
  switch (tab) {
    case 'products':
      return '/';
    case 'catalogues':
      return '/catalogues';
    case 'orders':
      return '/orders';
    case 'store':
      return '/store';
    default:
      return '/';
  }
};

export default function MainAppBottomNav({ active, sideDrawerOpen = false, modalOpen = false }: { active: MainAppTab; sideDrawerOpen?: boolean; modalOpen?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadOrders, setUnreadOrders] = useState<number>(0);

  // Hydrate unread count from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('catshare_unread_orders');
      const n = raw != null ? Number.parseInt(raw, 10) : 0;
      if (Number.isFinite(n) && n > 0) {
        setUnreadOrders(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Reset unread count when Orders tab is active / route is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isOnOrders =
      active === 'orders' || location.pathname === '/orders' || location.pathname.startsWith('/orders/');
    if (!isOnOrders) return;
    setUnreadOrders(0);
    try {
      window.localStorage.removeItem('catshare_unread_orders');
    } catch {
      /* ignore */
    }
  }, [active, location.pathname]);

  // Listen for new-order events emitted by `orderNotifications.ts`
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      setUnreadOrders((prev) => {
        const next = (prev || 0) + 1;
        try {
          window.localStorage.setItem('catshare_unread_orders', String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };

    window.addEventListener('catshareNewOrder', handler as EventListener);
    return () => {
      window.removeEventListener('catshareNewOrder', handler as EventListener);
    };
  }, []);

  const go = async (tab: MainAppTab) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      /* web */
    }

    if (tab === 'catalogues' && location.pathname === '/catalogues' && location.search) {
      navigate('/catalogues', { replace: true });
      return;
    }

    const dest = pathForTab(tab);
    if (location.pathname === dest && (tab !== 'catalogues' || !location.search)) {
      return;
    }

    navigate(dest);
  };

  const tabs: { id: MainAppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'products', label: 'Products', icon: FiPackage },
    { id: 'catalogues', label: 'Catalogues', icon: FiGrid },
    { id: 'orders', label: 'Orders', icon: FiShoppingCart },
    { id: 'store', label: 'Store', icon: FiShoppingBag },
  ];

  if (modalOpen) {
    return null;
  }

  const nav = (
    <nav
      className={`fixed inset-x-0 bottom-0 z-50 flex justify-around text-xs font-medium border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom,0px)] sm:text-sm transition-opacity ${
        sideDrawerOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Main navigation"
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => go(id)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors ${
            active === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="relative inline-flex">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            {id === 'orders' && unreadOrders > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-tight flex items-center justify-center border border-white shadow-sm">
                {unreadOrders > 9 ? '9+' : unreadOrders}
              </span>
            )}
          </span>
          <span className="text-xs sm:text-sm font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );

  if (typeof document === 'undefined') {
    return nav;
  }

  return createPortal(nav, document.body);
}
