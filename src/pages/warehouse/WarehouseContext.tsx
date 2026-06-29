import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import { isBrowserOnline } from '../../utils/cloudWritePolicy';
import {
  readCachedWarehouseSnapshot,
  writeCachedWarehouseSnapshot,
  type CachedWarehouseSnapshot,
} from '../../utils/warehouseCache';
import { loadWarehouseProducts, type WarehouseProduct } from './warehouseUtils';

function applyWarehouseSnapshot(
  snapshot: CachedWarehouseSnapshot,
  setters: {
    setWarehouseName: (v: string) => void;
    setWarehouseId: (v: string) => void;
    setMainInventoryId: (v: string) => void;
    setRooms: (v: InventoryRoom[]) => void;
    setMovements: (v: InventoryMovement[]) => void;
    setDeadStock: (v: DeadStockLine[]) => void;
  }
) {
  setters.setWarehouseName(snapshot.warehouseName);
  setters.setWarehouseId(snapshot.warehouseId);
  setters.setMainInventoryId(snapshot.mainInventoryId);
  setters.setRooms(snapshot.rooms);
  setters.setMovements(snapshot.movements);
  setters.setDeadStock(snapshot.deadStock);
}

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

  const persistSnapshot = useCallback(
    (patch: Partial<CachedWarehouseSnapshot> & Pick<CachedWarehouseSnapshot, 'warehouseId'>) => {
      if (!effectiveUid) return;
      const prev = readCachedWarehouseSnapshot(effectiveUid);
      writeCachedWarehouseSnapshot(effectiveUid, {
        warehouseName: patch.warehouseName ?? prev?.warehouseName ?? warehouseName,
        warehouseId: patch.warehouseId,
        mainInventoryId: patch.mainInventoryId ?? prev?.mainInventoryId ?? mainInventoryId,
        rooms: patch.rooms ?? prev?.rooms ?? rooms,
        movements: patch.movements ?? prev?.movements ?? movements,
        deadStock: patch.deadStock ?? prev?.deadStock ?? deadStock,
        cachedAt: Date.now(),
      });
    },
    [effectiveUid, warehouseName, mainInventoryId, rooms, movements, deadStock]
  );

  const hydrateFromCache = useCallback(
    (uid: string) => {
      const cached = readCachedWarehouseSnapshot(uid);
      if (!cached?.warehouseId) return false;
      applyWarehouseSnapshot(cached, {
        setWarehouseName,
        setWarehouseId,
        setMainInventoryId,
        setRooms,
        setMovements,
        setDeadStock,
      });
      setCatalogues(getAllCatalogues(uid));
      return true;
    },
    []
  );

  useLayoutEffect(() => {
    if (!effectiveUid) {
      setLoading(false);
      return;
    }
    const hasCache = hydrateFromCache(effectiveUid);
    setLoading(!hasCache);
    setError('');
  }, [effectiveUid, hydrateFromCache]);

  const refreshDeadStock = useCallback(async () => {
    if (!effectiveUid) return;
    const deadRes = await fetchDeadStock(
      effectiveUid,
      catalogues.map((c) => c.inventoryId).filter(Boolean) as string[]
    );
    const nextDead = deadRes.data ?? [];
    setDeadStock(nextDead);
    if (effectiveUid && warehouseId) {
      persistSnapshot({ warehouseId, deadStock: nextDead });
    }
  }, [effectiveUid, catalogues, warehouseId, persistSnapshot]);

  const refreshMovements = useCallback(async () => {
    if (!effectiveUid) return;
    const movRes = await fetchInventoryMovements(effectiveUid, { limit: 80 });
    const nextMovements = movRes.data ?? [];
    setMovements(nextMovements);
    if (effectiveUid && warehouseId) {
      persistSnapshot({ warehouseId, movements: nextMovements });
    }
  }, [effectiveUid, warehouseId, persistSnapshot]);

  const loadAll = useCallback(async () => {
    if (!effectiveUid) {
      setLoading(false);
      return;
    }

    const cached = readCachedWarehouseSnapshot(effectiveUid);
    const hasCache = Boolean(cached?.warehouseId);
    if (!hasCache) {
      setLoading(true);
    }
    setError('');

    if (!isBrowserOnline()) {
      if (hasCache) {
        hydrateFromCache(effectiveUid);
        setLoading(false);
        return;
      }
      setError('Offline — no saved warehouse data on this device.');
      setLoading(false);
      return;
    }

    try {
      const ensured = await ensureDefaultWarehouse(effectiveUid);
      if (ensured.error || !ensured.data) {
        if (hasCache) {
          hydrateFromCache(effectiveUid);
          showToast('Could not refresh warehouse. Showing saved data.', 'info');
        } else {
          setError('Could not initialize warehouse. Run sql/warehouse_inventory.sql in Supabase.');
        }
        setLoading(false);
        return;
      }

      const { warehouseId: whId, warehouseName: whName, mainInventoryId: mainId } = ensured.data;
      setWarehouseName(whName);
      setWarehouseId(whId);
      setMainInventoryId(mainId);

      const cats = getAllCatalogues(effectiveUid);
      setCatalogues(cats);

      const roomsRes = await fetchInventoryRooms(effectiveUid, whId);
      const nextRooms = roomsRes.data ?? [];

      const movRes = await fetchInventoryMovements(effectiveUid, { limit: 80 });
      const nextMovements = movRes.data ?? [];

      const deadRes = await fetchDeadStock(
        effectiveUid,
        cats.map((c) => c.inventoryId).filter(Boolean) as string[]
      );
      const nextDead = deadRes.data ?? [];

      setRooms(nextRooms);
      setMovements(nextMovements);
      setDeadStock(nextDead);

      writeCachedWarehouseSnapshot(effectiveUid, {
        warehouseName: whName,
        warehouseId: whId,
        mainInventoryId: mainId,
        rooms: nextRooms,
        movements: nextMovements,
        deadStock: nextDead,
        cachedAt: Date.now(),
      });
    } catch (e) {
      if (hasCache) {
        hydrateFromCache(effectiveUid);
        showToast(
          isBrowserOnline() ? 'Could not refresh warehouse. Showing saved data.' : 'Showing saved warehouse',
          'info'
        );
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load warehouse');
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveUid, hydrateFromCache, showToast]);

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
      setRooms((prev) => {
        const next = [...prev, res.data!];
        if (warehouseId) {
          persistSnapshot({ warehouseId, rooms: next });
        }
        return next;
      });
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
      setRooms((prev) => {
        const next = prev.map((r) => (r.id === room.id ? { ...r, name: newName.trim() } : r));
        if (warehouseId) {
          persistSnapshot({ warehouseId, rooms: next });
        }
        return next;
      });
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

      setRooms((prev) => {
        const next = prev.filter((r) => r.id !== room.id);
        if (warehouseId) {
          persistSnapshot({ warehouseId, rooms: next });
        }
        return next;
      });
      const movRes = await fetchInventoryMovements(effectiveUid, { limit: 80 });
      const nextMovements = movRes.data ?? [];
      setMovements(nextMovements);
      const deadRes = await fetchDeadStock(
        effectiveUid,
        catalogues.map((c) => c.inventoryId).filter(Boolean) as string[]
      );
      const nextDead = deadRes.data ?? [];
      setDeadStock(nextDead);
      if (warehouseId) {
        persistSnapshot({ warehouseId, movements: nextMovements, deadStock: nextDead });
      }
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
      const nextDead = deadRes.data ?? [];
      setDeadStock(nextDead);
      if (warehouseId) {
        persistSnapshot({ warehouseId, deadStock: nextDead });
      }
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
