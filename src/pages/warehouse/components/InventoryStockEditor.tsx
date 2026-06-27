import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import WarehouseQtyStepper from '../../../components/WarehouseQtyStepper';
import { useToast } from '../../../context/ToastContext';
import { useCloudWriteGate } from '../../../hooks/useCloudWriteGate';
import { adjustInventoryLevel, fetchInventoryLevels } from '../../../services/inventoryService';
import type { InventoryLevel } from '../../../types/inventory';
import { notifyWarehouseInventoryUpdated } from '../../../utils/catalogueWarehouseStock';
import {
  formatVariantSelectionSummary,
  getAllVariantCombinations,
  getProductVariantGroups,
  getVariantCombinationData,
  getVariantPrimaryImageUrl,
} from '../../../utils/productVariants';
import { useWarehouse } from '../WarehouseContext';
import { pickDisplayImage, stockLineKey, type WarehouseProduct } from '../warehouseUtils';

export default function InventoryStockEditor({ roomId }: { roomId: string }) {
  const { effectiveUid, products } = useWarehouse();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const [roomLoading, setRoomLoading] = useState(true);
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState('');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refreshLevels = useCallback(async () => {
    if (!effectiveUid || !roomId) return;
    const res = await fetchInventoryLevels(effectiveUid, roomId);
    if (!res.error) {
      const list = res.data ?? [];
      setLevels(list);
      const draft: Record<string, number> = {};
      for (const lvl of list) {
        draft[stockLineKey(lvl.productId, lvl.variantCombinationId)] = lvl.onHand;
      }
      setQtyDraft(draft);
    }
  }, [effectiveUid, roomId]);

  useEffect(() => {
    let cancelled = false;
    setRoomLoading(true);
    void (async () => {
      await refreshLevels();
      if (!cancelled) setRoomLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLevels]);

  useEffect(() => {
    return () => {
      for (const t of saveTimersRef.current.values()) clearTimeout(t);
      saveTimersRef.current.clear();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  useEffect(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return;
    const toExpand = new Set<string>();
    for (const product of filteredProducts) {
      const groups = getProductVariantGroups(product.raw);
      const combos = groups.length > 0 ? getAllVariantCombinations(groups) : [];
      if (combos.length === 0) continue;
      const nameMatch =
        product.name.toLowerCase().includes(q) || product.subtitle.toLowerCase().includes(q);
      const variantMatch = combos.some((combo) =>
        formatVariantSelectionSummary(groups, combo.selections).toLowerCase().includes(q)
      );
      if (nameMatch || variantMatch) toExpand.add(product.id);
    }
    if (toExpand.size > 0) {
      setExpandedProductIds((prev) => new Set([...prev, ...toExpand]));
    }
  }, [productSearch, filteredProducts]);

  const getLevelFor = useCallback(
    (productId: string, variantId: string | null) =>
      levels.find(
        (l) =>
          l.productId === productId &&
          (l.variantCombinationId ?? '') === (variantId ?? '')
      ),
    [levels]
  );

  const getQty = useCallback(
    (productId: string, variantId: string | null) => {
      const key = stockLineKey(productId, variantId);
      if (key in qtyDraft) return qtyDraft[key];
      return getLevelFor(productId, variantId)?.onHand ?? 0;
    },
    [qtyDraft, getLevelFor]
  );

  const persistQty = useCallback(
    async (productId: string, variantId: string | null, onHand: number) => {
      if (!effectiveUid || !roomId) return;
      if (!guardCloudWrite()) return;
      const level = getLevelFor(productId, variantId);
      const res = await adjustInventoryLevel(
        effectiveUid,
        roomId,
        productId,
        onHand,
        variantId,
        level?.lowStockThreshold ?? null
      );
      if (res.error) {
        showToast('Could not save stock', 'error');
        await refreshLevels();
        return;
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
      notifyWarehouseInventoryUpdated();
    },
    [effectiveUid, roomId, guardCloudWrite, getLevelFor, showToast, refreshLevels]
  );

  const scheduleQtySave = useCallback(
    (productId: string, variantId: string | null, onHand: number) => {
      const key = stockLineKey(productId, variantId);
      setQtyDraft((prev) => ({ ...prev, [key]: onHand }));
      const existing = saveTimersRef.current.get(key);
      if (existing) clearTimeout(existing);
      saveTimersRef.current.set(
        key,
        setTimeout(() => {
          saveTimersRef.current.delete(key);
          void persistQty(productId, variantId, onHand);
        }, 500)
      );
    },
    [persistQty]
  );

  const toggleProductExpanded = useCallback((productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const renderQtyStepper = (productId: string, variantId: string | null) => (
    <WarehouseQtyStepper
      value={getQty(productId, variantId)}
      onChange={(next) => scheduleQtySave(productId, variantId, next)}
    />
  );

  const renderSimpleProductRow = (product: WarehouseProduct) => {
    const displaySrc = pickDisplayImage(product, product.imageUrl);
    return (
      <div className="wh-product-group" key={product.id}>
        <div className="wh-product-row">
          <div className="wh-thumb">
            {displaySrc ? (
              <img src={displaySrc} alt={product.name} loading="lazy" />
            ) : (
              <span className="wh-thumb-placeholder">No img</span>
            )}
          </div>
          <div className="wh-product-text">
            <div className="wh-product-name">{product.name}</div>
            {product.subtitle ? <div className="wh-product-sub">{product.subtitle}</div> : null}
          </div>
          {renderQtyStepper(product.id, null)}
        </div>
      </div>
    );
  };

  const renderVariantProductGroup = (
    product: WarehouseProduct,
    combos: ReturnType<typeof getAllVariantCombinations>
  ) => {
    const groups = getProductVariantGroups(product.raw);
    const isOpen = expandedProductIds.has(product.id);
    const totalStock = combos.reduce(
      (sum, combo) => sum + getQty(product.id, combo.id || null),
      0
    );
    const displaySrc = pickDisplayImage(product, product.imageUrl);

    return (
      <div className="wh-product-group" key={product.id}>
        <button
          type="button"
          className={`wh-product-header${isOpen ? ' open' : ''}`}
          aria-expanded={isOpen}
          onClick={() => toggleProductExpanded(product.id)}
        >
          <span className={`wh-chevron${isOpen ? ' open' : ''}`} aria-hidden>
            <FiChevronDown size={16} />
          </span>
          <div className="wh-thumb">
            {displaySrc ? (
              <img src={displaySrc} alt={product.name} loading="lazy" />
            ) : (
              <span className="wh-thumb-placeholder">No img</span>
            )}
          </div>
          <div className="wh-product-text">
            <div className="wh-product-name">{product.name}</div>
            {product.subtitle ? <div className="wh-product-sub">{product.subtitle}</div> : null}
            <div className="wh-variant-meta">
              <span className="wh-variant-meta-pill">
                {combos.length} variant{combos.length === 1 ? '' : 's'}
              </span>
              <span className="wh-variant-meta-pill">{totalStock} in stock</span>
            </div>
          </div>
        </button>
        {isOpen ? (
          <div className="wh-variant-panel">
            {combos.map((combo) => {
              const variantData = getVariantCombinationData(product.raw, combo.selections);
              const variantLabel =
                formatVariantSelectionSummary(groups, combo.selections) || 'Variant';
              const variantSrc = pickDisplayImage(
                product,
                getVariantPrimaryImageUrl(product.raw, variantData) ?? product.imageUrl
              );
              return (
                <div key={combo.id || 'base'} className="wh-variant-row">
                  <div className="wh-thumb sm">
                    {variantSrc ? (
                      <img src={variantSrc} alt={variantLabel} loading="lazy" />
                    ) : (
                      <span className="wh-thumb-placeholder">No img</span>
                    )}
                  </div>
                  <div className="wh-product-text">
                    <div className="wh-variant-label">Variant</div>
                    <div className="wh-variant-name">{variantLabel}</div>
                  </div>
                  {renderQtyStepper(product.id, combo.id || null)}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  if (roomLoading) {
    return <div className="wh-spinner" />;
  }

  return (
    <>
      <div className="wh-stock-toolbar">
        <div className="wh-search-wrap">
          <FiSearch className="wh-search-icon" size={18} />
          <input
            className="wh-search"
            placeholder="Search products…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
        </div>
      </div>
      {filteredProducts.length === 0 ? (
        <div className="wh-card wh-empty">
          <div className="wh-empty-icon">
            <FiSearch size={22} />
          </div>
          {productSearch ? 'No products match your search.' : 'No products yet.'}
        </div>
      ) : (
        <div className="wh-product-list">
          {filteredProducts.map((product) => {
            const groups = getProductVariantGroups(product.raw);
            const combos = groups.length > 0 ? getAllVariantCombinations(groups) : [];
            if (combos.length === 0) return renderSimpleProductRow(product);
            return renderVariantProductGroup(product, combos);
          })}
        </div>
      )}
    </>
  );
}
