import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import {
  getAllVariantCombinations,
  type ProductVariantGroup,
} from '../utils/productVariants';
import WarehouseQtyStepper from './WarehouseQtyStepper';
import { notifyWarehouseInventoryUpdated } from '../utils/catalogueWarehouseStock';

function stockLineKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? ''}`;
}

export interface ProductCatalogueStockEditorHandle {
  flushPending: () => Promise<void>;
}

interface ProductCatalogueStockEditorProps {
  catalogue: Catalogue;
  productId: string;
  variantGroups: ProductVariantGroup[];
  inStock: boolean;
  onInStockChange: (inStock: boolean) => void;
  theme?: 'classic' | 'glass';
}

const ProductCatalogueStockEditor = forwardRef<
  ProductCatalogueStockEditorHandle,
  ProductCatalogueStockEditorProps
>(function ProductCatalogueStockEditor(
  { catalogue, productId, variantGroups, inStock, onInStockChange, theme = 'classic' },
  ref
) {
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
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const levelsRef = useRef(levels);
  const qtyDraftRef = useRef(qtyDraft);

  levelsRef.current = levels;
  qtyDraftRef.current = qtyDraft;

  const combinations = useMemo(
    () => getAllVariantCombinations(variantGroups),
    [variantGroups]
  );
  const hasVariants = combinations.length > 0;

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
  }, [usesWarehouseStock, effectiveUid, inventoryId, productId]);

  useEffect(() => {
    return () => {
      for (const t of saveTimersRef.current.values()) clearTimeout(t);
      saveTimersRef.current.clear();
    };
  }, []);

  const getLevelFor = useCallback(
    (variantId: string | null) =>
      levels.find(
        (l) =>
          l.productId === productId &&
          (l.variantCombinationId ?? '') === (variantId ?? '')
      ),
    [levels, productId]
  );

  const getQty = useCallback(
    (variantId: string | null) => {
      const key = stockLineKey(productId, variantId);
      if (key in qtyDraft) return qtyDraft[key];
      return getLevelFor(variantId)?.onHand ?? 0;
    },
    [qtyDraft, getLevelFor, productId]
  );

  const persistQty = useCallback(
    async (variantId: string | null, onHand: number) => {
      if (!effectiveUid || !inventoryId) return false;
      if (!guardCloudWrite()) return false;

      setSaving(true);
      const level = getLevelFor(variantId);
      const res = await adjustInventoryLevel(
        effectiveUid,
        inventoryId,
        productId,
        onHand,
        variantId,
        level?.lowStockThreshold ?? null
      );
      setSaving(false);

      if (res.error) {
        showToast('Could not save stock', 'error');
        return false;
      }

      if (res.data) {
        setLevels((prev) => {
          const idx = prev.findIndex(
            (l) =>
              l.productId === productId &&
              (l.variantCombinationId ?? '') === (variantId ?? '')
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data!;
            return next;
          }
          return [...prev, res.data!];
        });
      }

      const key = stockLineKey(productId, variantId);
      setQtyDraft((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      notifyWarehouseInventoryUpdated();
      return true;
    },
    [effectiveUid, inventoryId, productId, guardCloudWrite, getLevelFor, showToast]
  );

  const scheduleQtySave = useCallback(
    (variantId: string | null, onHand: number) => {
      const key = stockLineKey(productId, variantId);
      setQtyDraft((prev) => ({ ...prev, [key]: onHand }));
      const existing = saveTimersRef.current.get(key);
      if (existing) clearTimeout(existing);
      saveTimersRef.current.set(
        key,
        setTimeout(() => {
          saveTimersRef.current.delete(key);
          void persistQty(variantId, onHand);
        }, 500)
      );
    },
    [persistQty, productId]
  );

  const flushPending = useCallback(async () => {
    for (const t of saveTimersRef.current.values()) clearTimeout(t);
    saveTimersRef.current.clear();

    const draft = qtyDraftRef.current;
    const entries = Object.entries(draft);
    for (const [key, onHand] of entries) {
      const sep = key.indexOf('::');
      const variantId = sep >= 0 ? key.slice(sep + 2) || null : null;
      await persistQty(variantId, onHand);
    }
  }, [persistQty]);

  useImperativeHandle(ref, () => ({ flushPending }), [flushPending]);

  const labelClass =
    theme === 'glass'
      ? 'text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2'
      : 'text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2';

  if (!usesWarehouseStock) {
    if (hasVariants) {
      return (
        <div className="flex gap-3 items-start">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
            Stock
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 pt-0.5">
            This product has variants — set stock per variant in the <span className="font-semibold">Variants</span> tab
            (per catalogue).
          </p>
        </div>
      );
    }

    return (
      <div className="flex gap-3 items-center">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
          Stock
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
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

  const renderVariantRow = (variantId: string | null, label: string) => (
    <div
      key={variantId ?? 'base'}
      className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
    >
      <span className="text-xs text-gray-700 dark:text-gray-300 min-w-0 truncate">{label}</span>
      <WarehouseQtyStepper
        value={getQty(variantId)}
        disabled={saving || loading || !effectiveUid}
        onChange={(next) => scheduleQtySave(variantId, next)}
      />
    </div>
  );

  return (
    <div className="flex gap-3 items-start">
      <label className={labelClass}>Stock</label>
      <div className="flex-1 min-w-0">
        {hasVariants ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Set quantity per variant in the <span className="font-semibold">Variants</span> tab (per catalogue).
            {roomName ? ` Inventory: ${roomName}.` : ''}
          </p>
        ) : (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
            {roomName ? `Inventory: ${roomName}` : 'Warehouse stock'}
            {!effectiveUid ? ' — sign in to sync stock' : null}
          </p>
        )}
        {loading ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Loading stock…</p>
        ) : hasVariants ? null : (
          renderVariantRow(null, 'Units on hand')
        )}
      </div>
    </div>
  );
});

export default ProductCatalogueStockEditor;
