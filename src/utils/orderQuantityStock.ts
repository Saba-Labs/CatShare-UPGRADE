import type { Catalogue } from '../config/catalogueConfig';
import {
  getAvailableQty,
  isCatalogueInventoryTracked,
  type InventoryAvailabilityMap,
} from './inventoryAvailability';
import {
  getEffectiveMinimumOrderQuantity,
  roundQuantityToRules,
} from './quantityPricingUtils';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';

export function applyInventoryCapToQuantity(
  quantity: number,
  stepRaw: unknown,
  moqRaw: unknown,
  catalogue: Catalogue | null | undefined,
  inventoryMap: InventoryAvailabilityMap | null | undefined,
  productId: string,
  variantCombinationId?: string | null
): { quantity: number; wasCapped: boolean; available: number | null } {
  let qty = roundQuantityToRules(quantity, stepRaw, moqRaw);
  const available =
    isCatalogueInventoryTracked(catalogue, inventoryMap)
      ? getAvailableQty(catalogue, inventoryMap, productId, variantCombinationId ?? null)
      : null;

  if (available == null || qty <= available) {
    return { quantity: qty, wasCapped: false, available };
  }

  const step = normalizeOrderQuantityStep(stepRaw);
  const moq = getEffectiveMinimumOrderQuantity(moqRaw, step);
  let capped = Math.floor(available);

  if (step > 1) {
    capped = Math.floor(capped / step) * step;
  }
  if (capped > 0 && capped < moq) {
    capped = 0;
  }

  return { quantity: capped, wasCapped: qty !== capped, available };
}
