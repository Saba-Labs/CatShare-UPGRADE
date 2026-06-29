import type {
  DeadStockLine,
  InventoryLevel,
  InventoryMovement,
  InventoryRoom,
} from '../types/inventory';
import { getStorageKey, safeGetFromStorage, safeSetInStorage } from './safeStorage';

export interface CachedWarehouseSnapshot {
  warehouseName: string;
  warehouseId: string;
  mainInventoryId: string;
  rooms: InventoryRoom[];
  movements: InventoryMovement[];
  deadStock: DeadStockLine[];
  cachedAt: number;
}

export const warehouseSnapshotCacheKey = (uid: string) => getStorageKey('warehouseSnapshot', uid);

export function warehouseLevelsCacheKey(uid: string, roomId: string): string {
  return getStorageKey(`warehouseLevels_${roomId}`, uid);
}

export function readCachedWarehouseSnapshot(uid: string): CachedWarehouseSnapshot | null {
  const parsed = safeGetFromStorage<CachedWarehouseSnapshot | null>(warehouseSnapshotCacheKey(uid), null);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.warehouseId?.trim()) return null;
  return {
    warehouseName: String(parsed.warehouseName ?? 'Default warehouse'),
    warehouseId: String(parsed.warehouseId),
    mainInventoryId: String(parsed.mainInventoryId ?? ''),
    rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
    movements: Array.isArray(parsed.movements) ? parsed.movements : [],
    deadStock: Array.isArray(parsed.deadStock) ? parsed.deadStock : [],
    cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0,
  };
}

export function writeCachedWarehouseSnapshot(uid: string, snapshot: CachedWarehouseSnapshot): void {
  safeSetInStorage(warehouseSnapshotCacheKey(uid), {
    ...snapshot,
    cachedAt: Date.now(),
  });
}

export function readCachedInventoryLevels(uid: string, roomId: string): InventoryLevel[] {
  if (!roomId) return [];
  const parsed = safeGetFromStorage<InventoryLevel[]>(warehouseLevelsCacheKey(uid, roomId), []);
  return Array.isArray(parsed) ? parsed : [];
}

export function writeCachedInventoryLevels(
  uid: string,
  roomId: string,
  levels: InventoryLevel[]
): void {
  if (!roomId) return;
  safeSetInStorage(warehouseLevelsCacheKey(uid, roomId), levels);
}

export function patchCachedInventoryLevel(
  uid: string,
  roomId: string,
  level: InventoryLevel
): void {
  const levels = readCachedInventoryLevels(uid, roomId);
  const idx = levels.findIndex(
    (l) =>
      l.productId === level.productId &&
      (l.variantCombinationId ?? '') === (level.variantCombinationId ?? '')
  );
  const next = [...levels];
  if (idx >= 0) next[idx] = level;
  else next.push(level);
  writeCachedInventoryLevels(uid, roomId, next);
}
