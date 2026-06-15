import { useEffect, useState, useCallback } from 'react';
import type { Catalogue } from '../config/catalogueConfig';
import { getStorefrontInventory } from '../services/inventoryService';
import {
  buildInventoryAvailabilityMap,
  type InventoryAvailabilityMap,
} from '../utils/inventoryAvailability';

/** Loads warehouse stock levels for a catalogue's linked room (seller / manual order flows). */
export function useCatalogueInventoryMap(
  userId: string | undefined,
  catalogue: Catalogue | null | undefined
): InventoryAvailabilityMap | null {
  const [inventoryMap, setInventoryMap] = useState<InventoryAvailabilityMap | null>(null);

  const reload = useCallback(() => {
    if (!userId || !catalogue?.id) {
      setInventoryMap(null);
      return;
    }
    if (!catalogue.inventoryId?.trim()) {
      setInventoryMap(null);
      return;
    }

    void getStorefrontInventory(userId, catalogue.id).then((res) => {
      setInventoryMap(buildInventoryAvailabilityMap(res.data.lines));
    });
  }, [userId, catalogue?.id, catalogue?.inventoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onRefresh = () => reload();
    window.addEventListener('warehouse-inventory-updated', onRefresh);
    const onVis = () => {
      if (document.visibilityState === 'visible') onRefresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('warehouse-inventory-updated', onRefresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reload]);

  return inventoryMap;
}
