import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import InventoryStockEditor from './components/InventoryStockEditor';
import WarehouseShell from './components/WarehouseShell';
import { useWarehouse } from './WarehouseContext';

export default function WarehouseInventoryStock() {
  const { roomId } = useParams<{ roomId: string }>();
  const { loading, rooms } = useWarehouse();

  const room = useMemo(
    () => (roomId ? rooms.find((r) => r.id === roomId) : undefined),
    [rooms, roomId]
  );

  if (loading) {
    return (
      <WarehouseShell title="Stock" backTo="/warehouse">
        <div className="wh-spinner" />
      </WarehouseShell>
    );
  }

  if (!roomId || !room) {
    return (
      <WarehouseShell title="Inventory" backTo="/warehouse">
        <div className="wh-card wh-empty">Inventory not found.</div>
      </WarehouseShell>
    );
  }

  return (
    <WarehouseShell title={room.name} backTo="/warehouse">
      <InventoryStockEditor roomId={roomId} />
    </WarehouseShell>
  );
}
