import { NavLink, useMatch } from 'react-router-dom';
import { FiBookOpen, FiClock, FiPackage } from 'react-icons/fi';

const NAV_ITEMS = [
  { to: '/warehouse', label: 'Inventories', icon: FiPackage, end: true },
  { to: '/warehouse/catalogues', label: 'Catalogues', icon: FiBookOpen, end: false },
  { to: '/warehouse/history', label: 'History', icon: FiClock, end: false },
] as const;

export default function WarehouseBottomNav() {
  const stockFocusMatch = useMatch('/warehouse/inventories/:roomId');

  if (stockFocusMatch) {
    return null;
  }

  return (
    <nav className="wh-bottom-nav" aria-label="Warehouse navigation">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `wh-bottom-nav__item${isActive ? ' active' : ''}`}
        >
          <Icon aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
