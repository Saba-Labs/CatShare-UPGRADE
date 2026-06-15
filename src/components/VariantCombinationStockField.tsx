import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiPackage, FiX } from 'react-icons/fi';
import type { Catalogue } from '../config/catalogueConfig';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import {
  adjustInventoryLevel,
  ensureDefaultWarehouse,
  fetchInventoryLevels,
  fetchInventoryRooms,
} from '../services/inventoryService';
import type { InventoryLevel } from '../types/inventory';
import { getPersistedAuthUserId } from '../utils/authUserId';
import WarehouseQtyStepper from './WarehouseQtyStepper';
import { notifyWarehouseInventoryUpdated } from '../utils/catalogueWarehouseStock';

interface VariantCombinationStockFieldProps {
  catalogue: Catalogue;
  productId: string;
  variantCombinationId: string;
  /** Legacy in/out when catalogue has no warehouse room */
  inStock: boolean;
  onInStockChange: (inStock: boolean) => void;
  disabled?: boolean;
}

export default function VariantCombinationStockField({
  catalogue,
  productId,
  variantCombinationId,
  inStock,
  onInStockChange,
  disabled = false,
}: VariantCombinationStockFieldProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const effectiveUid = useMemo(
    () => user?.uid ?? getPersistedAuthUserId() ?? null,
    [user?.uid]
  );

  const inventoryId = catalogue.inventoryId?.trim() || '';
  const usesWarehouseStock = Boolean(inventoryId);

  const [roomName, setRoomName] = useState('');
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!usesWarehouseStock || !effectiveUid || !inventoryId) {
      setLevels([]);
      setRoomName('');
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      await ensureDefaultWarehouse(effectiveUid).catch(() => undefined);
      const [roomsRes, levelsRes] = await Promise.all([
        fetchInventoryRooms(effectiveUid),
        fetchInventoryLevels(effectiveUid, inventoryId),
      ]);
      if (cancelled) return;

      const room = roomsRes.data?.find((r) => r.id === inventoryId);
      setRoomName(room?.name || 'Inventory');
      setLevels(levelsRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [usesWarehouseStock, effectiveUid, inventoryId, productId, variantCombinationId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const level = useMemo(
    () =>
      levels.find(
        (l) =>
          l.productId === productId &&
          (l.variantCombinationId ?? '') === variantCombinationId
      ),
    [levels, productId, variantCombinationId]
  );

  const qty = qtyDraft ?? level?.onHand ?? 0;

  const persistQty = useCallback(
    async (onHand: number) => {
      if (!effectiveUid || !inventoryId) return;
      if (!guardCloudWrite()) return;

      setSaving(true);
      const res = await adjustInventoryLevel(
        effectiveUid,
        inventoryId,
        productId,
        onHand,
        variantCombinationId,
        level?.lowStockThreshold ?? null
      );
      setSaving(false);

      if (res.error) {
        showToast('Could not save stock', 'error');
        return;
      }

      if (res.data) {
        setLevels((prev) => {
          const idx = prev.findIndex(
            (l) =>
              l.productId === productId &&
              (l.variantCombinationId ?? '') === variantCombinationId
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data!;
            return next;
          }
          return [...prev, res.data!];
        });
      }
      setQtyDraft(null);
      notifyWarehouseInventoryUpdated();
    },
    [
      effectiveUid,
      inventoryId,
      productId,
      variantCombinationId,
      guardCloudWrite,
      level?.lowStockThreshold,
      showToast,
    ]
  );

  const scheduleQtySave = useCallback(
    (onHand: number) => {
      setQtyDraft(onHand);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persistQty(onHand);
      }, 500);
    },
    [persistQty]
  );

  if (!usesWarehouseStock) {
    return (
      <div className="flex gap-3 items-center">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
          Stock
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onInStockChange(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              inStock
                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md shadow-green-500/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-green-400'
            }`}
          >
            <FiPackage size={14} />
            <span>In Stock</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onInStockChange(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              !inStock
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-500/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-red-400'
            }`}
          >
            <FiX size={14} />
            <span>Out of Stock</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-center">
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
        Stock
      </label>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 min-w-0">
          {loading
            ? 'Loading…'
            : roomName
              ? `${roomName}${!effectiveUid ? ' — sign in to sync' : ''}`
              : 'Warehouse'}
        </p>
        <WarehouseQtyStepper
          value={qty}
          disabled={disabled || saving || loading || !effectiveUid}
          onChange={scheduleQtySave}
        />
      </div>
    </div>
  );
}
