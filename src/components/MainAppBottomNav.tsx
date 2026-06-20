import { createPortal } from 'react-dom';
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
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
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
