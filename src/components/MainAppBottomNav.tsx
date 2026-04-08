import { useNavigate, useLocation } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

export default function MainAppBottomNav({ active }: { active: MainAppTab }) {
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

  const tabs: { id: MainAppTab; label: string }[] = [
    { id: 'products', label: 'Products' },
    { id: 'catalogues', label: 'Catalogues' },
    { id: 'orders', label: 'Orders' },
    { id: 'store', label: 'Store' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-around text-xs font-medium pb-[env(safe-area-inset-bottom,0px)] border-t border-gray-200 bg-white sm:text-sm"
      aria-label="Main navigation"
    >
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => go(id)}
          className={`flex-1 py-3 text-center transition-colors ${
            active === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
