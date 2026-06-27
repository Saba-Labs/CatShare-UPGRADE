import { Navigate, Route, Routes } from 'react-router-dom';
import WarehouseLayout from './WarehouseLayout';
import WarehouseInventories from './WarehouseInventories';
import WarehouseInventoryStock from './WarehouseInventoryStock';
import WarehouseCatalogues from './WarehouseCatalogues';
import WarehouseDeadStock from './WarehouseDeadStock';
import WarehouseHistory from './WarehouseHistory';

export default function WarehouseRoutes() {
  return (
    <Routes>
      <Route element={<WarehouseLayout />}>
        <Route index element={<WarehouseInventories />} />
        <Route path="inventories" element={<Navigate to="/warehouse" replace />} />
        <Route path="inventories/:roomId" element={<WarehouseInventoryStock />} />
        <Route path="catalogues" element={<WarehouseCatalogues />} />
        <Route path="dead-stock" element={<WarehouseDeadStock />} />
        <Route path="history" element={<WarehouseHistory />} />
      </Route>
    </Routes>
  );
}
