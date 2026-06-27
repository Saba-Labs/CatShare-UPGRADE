import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import {
  getAllCatalogues,
  getCataloguesDefinition,
  setCataloguesDefinition,
  type Catalogue,
} from '../../config/catalogueConfig';
import { syncCataloguesDefinition } from '../../services/supabaseSync';
import {
  createInventoryRoom,
  deleteInventoryRoom,
  ensureDefaultWarehouse,
  fetchDeadStock,
  fetchInventoryMovements,
  fetchInventoryRooms,
  updateInventoryRoom,
} from '../../services/inventoryService';
import type { DeadStockLine, InventoryMovement, InventoryRoom } from '../../types/inventory';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { loadWarehouseProducts, type WarehouseProduct } from './warehouseUtils';

export interface WarehouseContextValue {
  effectiveUid: string | null;
  loading: boolean;
  error: string;
  warehouseName: string;
  warehouseId: string;
  mainInventoryId: string;
  rooms: InventoryRoom[];
  catalogues: Catalogue[];
  movements: InventoryMovement[];
  deadStock: DeadStockLine[];
  products: WarehouseProduct[];
  productById: Map<string, WarehouseProduct>;
  roomNameById: Map<string, string>;
  loadAll: () => Promise<void>;
  refreshDeadStock: () => Promise<void>;
  refreshMovements: () => Promise<void>;
  addRoom: (name: string) => Promise<void>;
  renameRoom: (room: InventoryRoom, newName: string) => Promise<boolean>;
  deleteRoom: (room: InventoryRoom) => Promise<boolean>;
  linkCatalogue: (catalogueId: string, inventoryId: string) => Promise<void>;
  cataloguesForRoom: (roomId: string) => Catalogue[];
}

const WarehouseContext = createContext<WarehouseContextValue | undefined>(undefined);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const effectiveUid = useMemo(
    () => user?.uid ?? getPersistedAuthUserId() ?? null,
    [user?.uid]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warehouseName, setWarehouseName] = useState('Default warehouse');
  const [warehouseId, setWarehouseId] = useState('');
  const [mainInventoryId, setMainInventoryId] = useState('');
  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockLine[]>([]);

  const products = useMemo(
    () => loadWarehouseProducts(effectiveUid),
    [effectiveUid, loading]
  );

  const productById = useMemo(() => {
    const map = new Map<string, WarehouseProduct>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms) map.set(r.id, r.name);
    return map;
  }, [rooms]);

  const refreshDeadStock = useCallback(async () => {
    if (!effectiveUid) return;
    const deadRes = await fetchDeadStock(
      effectiveUid,
      catalogues.map((c) => c.inventoryId).filter(Boolean) as string[]
    );
    setDeadStock(deadRes.data ?? []);
  }, [effectiveUid, catalogues]);

  const refreshMovements = useCallback(async () => {
    if (!effectiveUid) return;
    const movRes = await fetchInventoryMovements(effectiveUid, { limit: 80 });
    setMovements(movRes.data ?? []);
  }, [effectiveUid]);

  const loadAll = useCallback(async () => {
    if (!effectiveUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ensured = await ensureDefaultWarehouse(effectiveUid);
      if (ensured.error || !ensured.data) {
        setError('Could not initialize warehouse. Run sql/warehouse_inventory.sql in Supabase.');
        setLoading(false);
        return;
      }
      setWarehouseName(ensured.data.warehouseName);
      setWarehouseId(ensured.data.warehouseId);
      setMainInventoryId(ensured.data.mainInventoryId);
      const cats = getAllCatalogues(effectiveUid);
      setCatalogues(cats);
      const roomsRes = await fetchInventoryRooms(effectiveUid, ensured.data.warehouseId);
      setRooms(roomsRes.data ?? []);
      const movRes = await fetchInventoryMovements(effectiveUid, { limit: 80 });
      setMovements(movRes.data ?? []);
      const deadRes = await fetchDeadStock(
        effectiveUid,
        cats.map((c) => c.inventoryId).filter(Boolean) as string[]
      );
      setDeadStock(deadRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load warehouse');
    } finally {
      setLoading(false);
    }
  }, [effectiveUid]);

  useEffect(() => {
    if (authLoading && !effectiveUid) return;
    void loadAll();
  }, [authLoading, effectiveUid, loadAll]);

  const addRoom = useCallback(
    async (name: string) => {
      if (!effectiveUid || !warehouseId || !name.trim()) return;
      if (!guardCloudWrite()) return;
      const res = await createInventoryRoom(
        effectiveUid,
        warehouseId,
        name.trim(),
        rooms.length
      );
      if (res.error || !res.data) {
        showToast('Could not add inventory', 'error');
        return;
      }
      setRooms((prev) => [...prev, res.data!]);
      showToast('Inventory added', 'success');
    },
    [effectiveUid, warehouseId, rooms.length, guardCloudWrite, showToast]
  );

  const renameRoom = useCallback(
    async (room: InventoryRoom, newName: string): Promise<boolean> => {
      if (!effectiveUid || !newName.trim()) return false;
      if (!guardCloudWrite()) return false;
      const res = await updateInventoryRoom(effectiveUid, room.id, { name: newName.trim() });
      if (res.error) {
        showToast('Rename failed', 'error');
        return false;
      }
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, name: newName.trim() } : r))
      );
      showToast('Inventory renamed', 'success');
      return true;
    },
    [effectiveUid, guardCloudWrite, showToast]
  );

  const cataloguesForRoom = useCallback(
    (roomId: string) => catalogues.filter((c) => c.inventoryId === roomId),
    [catalogues]
  );

  const deleteRoom = useCallback(
    async (room: InventoryRoom): Promise<boolean> => {
      if (!effectiveUid) return false;
      if (room.id === mainInventoryId) {
        showToast('The default inventory cannot be deleted', 'error');
        return false;
      }
      const linked = catalogues.filter((c) => c.inventoryId === room.id);
      if (linked.length > 0) {
        const names = linked.map((c) => c.label).join(', ');
        showToast(`Unlink from catalogues first: ${names}`, 'error');
        return false;
      }
      if (!guardCloudWrite()) return false;

      const res = await deleteInventoryRoom(effectiveUid, room.id);
      if (!res.ok) {
        showToast('Could not delete inventory', 'error');
        return false;
      }

      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      const movRes = await fetchInventoryMovements(effectiveUid, { limit: 80 });
      setMovements(movRes.data ?? []);
      const deadRes = await fetchDeadStock(
        effectiveUid,
        catalogues.map((c) => c.inventoryId).filter(Boolean) as string[]
      );
      setDeadStock(deadRes.data ?? []);
      showToast('Inventory deleted', 'success');
      return true;
    },
    [effectiveUid, mainInventoryId, catalogues, guardCloudWrite, showToast]
  );

  const linkCatalogue = useCallback(
    async (catalogueId: string, inventoryId: string) => {
      if (!effectiveUid) return;
      if (!guardCloudWrite()) return;
      const def = getCataloguesDefinition(effectiveUid);
      const nextCats = def.catalogues.map((c) =>
        c.id === catalogueId ? { ...c, inventoryId: inventoryId || null } : c
      );
      const next = { ...def, catalogues: nextCats, lastUpdated: Date.now() };
      setCataloguesDefinition(next);
      setCatalogues(nextCats);
      await syncCataloguesDefinition(effectiveUid, next);
      const deadRes = await fetchDeadStock(
        effectiveUid,
        nextCats.map((c) => c.inventoryId).filter(Boolean) as string[]
      );
      setDeadStock(deadRes.data ?? []);
      showToast('Catalogue link updated', 'success');
    },
    [effectiveUid, guardCloudWrite, showToast]
  );

  const value = useMemo<WarehouseContextValue>(
    () => ({
      effectiveUid,
      loading,
      error,
      warehouseName,
      warehouseId,
      mainInventoryId,
      rooms,
      catalogues,
      movements,
      deadStock,
      products,
      productById,
      roomNameById,
      loadAll,
      refreshDeadStock,
      refreshMovements,
      addRoom,
      renameRoom,
      deleteRoom,
      linkCatalogue,
      cataloguesForRoom,
    }),
    [
      effectiveUid,
      loading,
      error,
      warehouseName,
      warehouseId,
      mainInventoryId,
      rooms,
      catalogues,
      movements,
      deadStock,
      products,
      productById,
      roomNameById,
      loadAll,
      refreshDeadStock,
      refreshMovements,
      addRoom,
      renameRoom,
      deleteRoom,
      linkCatalogue,
      cataloguesForRoom,
    ]
  );

  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse(): WarehouseContextValue {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error('useWarehouse must be used within WarehouseProvider');
  return ctx;
}
