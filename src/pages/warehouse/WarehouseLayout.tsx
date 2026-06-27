import { Outlet, useMatch } from 'react-router-dom';
import WarehouseBottomNav from './components/WarehouseBottomNav';
import { WarehouseProvider } from './WarehouseContext';
import './warehouse.css';

export default function WarehouseLayout() {
  const stockFocusMatch = useMatch('/warehouse/inventories/:roomId');

  return (
    <WarehouseProvider>
      <div className={`wh-root${stockFocusMatch ? ' wh-no-bottom-nav' : ''}`}>
        <Outlet />
        <WarehouseBottomNav />
      </div>
    </WarehouseProvider>
  );
}
