import type { Catalogue } from '../config/catalogueConfig';
import type { StorefrontInventoryLine } from '../types/inventory';

export type InventoryAvailabilityMap = Map<string, StorefrontInventoryLine>;

function levelKey(productId: string, variantCombinationId?: string | null): string {
  return `${productId}::${variantCombinationId ?? ''}`;
}

export function buildInventoryAvailabilityMap(
  lines: StorefrontInventoryLine[]
): InventoryAvailabilityMap {
  const map: InventoryAvailabilityMap = new Map();
  for (const line of lines) {
    map.set(levelKey(line.productId, line.variantCombinationId), line);
  }
  return map;
}

export function resolveCatalogueInventoryId(
  catalogue: Catalogue | null | undefined,
  resolvedInventoryId?: string | null
): string | null {
  const fromRpc = resolvedInventoryId?.trim();
  if (fromRpc) return fromRpc;
  const fromCatalogue = catalogue?.inventoryId?.trim();
  return fromCatalogue || null;
}

export function isCatalogueInventoryTracked(
  catalogue: Catalogue | null | undefined,
  _inventoryMap?: InventoryAvailabilityMap | null | undefined,
  resolvedInventoryId?: string | null
): boolean {
  return Boolean(resolveCatalogueInventoryId(catalogue, resolvedInventoryId));
}

/** null = unlimited / legacy boolean mode; number = tracked qty (missing row = 0) */
export function getAvailableQty(
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  productId: string,
  variantCombinationId?: string | null,
  resolvedInventoryId?: string | null
): number | null {
  if (!isCatalogueInventoryTracked(catalogue, inventoryMap, resolvedInventoryId)) {
    return null;
  }
  if (!inventoryMap) {
    return 0;
  }
  const line = inventoryMap.get(levelKey(productId, variantCombinationId));
  if (!line) {
    return 0;
  }
  return line.onHand;
}

export function isLowStock(
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  productId: string,
  variantCombinationId?: string | null,
  resolvedInventoryId?: string | null
): boolean {
  if (!isCatalogueInventoryTracked(catalogue, inventoryMap, resolvedInventoryId) || !inventoryMap) return false;
  const line = inventoryMap.get(levelKey(productId, variantCombinationId));
  if (!line || line.lowStockThreshold == null) return false;
  return line.onHand <= line.lowStockThreshold;
}

export function isInStockWithInventory(
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  productId: string,
  variantCombinationId?: string | null,
  legacyBooleanInStock = true,
  resolvedInventoryId?: string | null
): boolean {
  if (!isCatalogueInventoryTracked(catalogue, inventoryMap, resolvedInventoryId)) {
    return legacyBooleanInStock;
  }
  if (!inventoryMap) {
    return false;
  }
  const qty = getAvailableQty(
    catalogue,
    inventoryMap,
    productId,
    variantCombinationId,
    resolvedInventoryId
  );
  return (qty ?? 0) > 0;
}
