import { getAllCatalogues, type Catalogue } from '../config/catalogueConfig';
import {
  isProductInStockForCatalogue,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import {
  getAvailableQty,
  isCatalogueInventoryTracked,
  type InventoryAvailabilityMap,
} from './inventoryAvailability';
import {
  generateVariantCombinationId,
  getAllVariantCombinations,
  getProductVariantGroups,
  getVariantLegacyInStock,
  isVariantSelectionComplete,
  type ProductVariantGroup,
} from './productVariants';

export const CATALOGUE_WAREHOUSE_STOCK_WARNING =
  'This catalogue is linked to warehouse inventory. Change stock in Warehouse or use quantity fields — In Stock / Out of Stock cannot be toggled here.';

export function isCatalogueLinkedToWarehouse(
  catalogue: Catalogue | null | undefined
): boolean {
  return Boolean(catalogue?.inventoryId?.trim());
}

export function findCatalogueById(catalogueId: string): Catalogue | null {
  const id = String(catalogueId ?? '').trim();
  if (!id) return null;
  return getAllCatalogues().find((c) => c.id === id) ?? null;
}

export function isCatalogueStockToggleLocked(catalogueId: string): boolean {
  return isCatalogueLinkedToWarehouse(findCatalogueById(catalogueId));
}

/** Seller gallery / preview: warehouse qty when linked, else legacy in/out flag. */
export function isProductInStockForSellerCatalogue(
  product: ProductWithCatalogueData,
  catalogueId: string,
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined
): boolean {
  const cat = catalogue ?? findCatalogueById(catalogueId);
  if (!isCatalogueInventoryTracked(cat, inventoryMap)) {
    return isProductInStockForCatalogue(product, catalogueId, cat);
  }

  const groups = getProductVariantGroups(product);
  if (groups.length === 0) {
    const qty = getAvailableQty(cat, inventoryMap, product.id, null);
    return (qty ?? 0) > 0;
  }

  return getAllVariantCombinations(groups).some((combo) => {
    const qty = getAvailableQty(cat, inventoryMap, product.id, combo.id || null);
    return (qty ?? 0) > 0;
  });
}

/** Create-order / line UI: show out-of-stock when tracked qty is 0 for the resolved SKU. */
export function isOrderLineOutOfStock(
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  product: ProductWithCatalogueData,
  variantSelection?: Record<string, string> | null
): boolean {
  if (!isCatalogueInventoryTracked(catalogue, inventoryMap)) {
    return false;
  }

  const groups = getProductVariantGroups(product);
  if (groups.length === 0) {
    return (getAvailableQty(catalogue, inventoryMap, product.id, null) ?? 0) <= 0;
  }

  if (isVariantSelectionComplete(groups, variantSelection)) {
    const variantId = generateVariantCombinationId(variantSelection!);
    return (getAvailableQty(catalogue, inventoryMap, product.id, variantId) ?? 0) <= 0;
  }

  const combos = getAllVariantCombinations(groups);
  if (combos.length === 0) return false;
  return combos.every(
    (combo) => (getAvailableQty(catalogue, inventoryMap, product.id, combo.id || null) ?? 0) <= 0
  );
}

/** Whether a fully resolved variant SKU has sellable stock (warehouse qty or legacy in/out). */
export function isVariantCombinationInStock(
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  product: ProductWithCatalogueData,
  catalogueId: string,
  variantCombinationId: string
): boolean {
  if (isCatalogueInventoryTracked(catalogue, inventoryMap)) {
    if (!inventoryMap) return true;
    return (getAvailableQty(catalogue, inventoryMap, product.id, variantCombinationId) ?? 0) > 0;
  }

  const productLevelInStock = isProductInStockForCatalogue(product, catalogueId, catalogue);
  return getVariantLegacyInStock(product, catalogueId, variantCombinationId, productLevelInStock);
}

/**
 * Whether choosing `option` in `groupId` can lead to any in-stock SKU,
 * respecting other groups already picked in `currentSelection`.
 */
export function isVariantOptionInStock(
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  product: ProductWithCatalogueData,
  catalogueId: string,
  groups: ProductVariantGroup[],
  currentSelection: Record<string, string>,
  groupId: string,
  option: string
): boolean {
  if (groups.length === 0) return true;

  const combos = getAllVariantCombinations(groups);

  for (const combo of combos) {
    if (combo.selections[groupId] !== option) continue;

    let matchesPartial = true;
    for (const g of groups) {
      if (g.id === groupId) continue;
      const picked = currentSelection[g.id];
      if (picked && combo.selections[g.id] !== picked) {
        matchesPartial = false;
        break;
      }
    }
    if (!matchesPartial) continue;

    if (isVariantCombinationInStock(catalogue, inventoryMap, product, catalogueId, combo.id)) {
      return true;
    }
  }

  return false;
}

export function notifyWarehouseInventoryUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('warehouse-inventory-updated'));
  }
}
