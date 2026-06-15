import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import WarehouseQtyStepper from '../components/WarehouseQtyStepper';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../utils/authUserId';
import { notifyWarehouseInventoryUpdated } from '../utils/catalogueWarehouseStock';
import { getAllCatalogues, getCataloguesDefinition, setCataloguesDefinition, type Catalogue } from '../config/catalogueConfig';
import { syncCataloguesDefinition } from '../services/supabaseSync';
import { readProductsWithLegacyFallback } from '../utils/safeStorage';
import {
  adjustInventoryLevel,
  createInventoryRoom,
  ensureDefaultWarehouse,
  fetchDeadStock,
  fetchInventoryLevels,
  fetchInventoryMovements,
  fetchInventoryRooms,
  updateInventoryRoom,
} from '../services/inventoryService';
import type { DeadStockLine, InventoryLevel, InventoryMovement, InventoryRoom } from '../types/inventory';
import {
  formatVariantSelectionSummary,
  getAllVariantCombinations,
  getProductVariantGroups,
  getVariantCombinationData,
} from '../utils/productVariants';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { getProductImageUrls } from '../utils/productImages';
import MainAppBottomNav from '../components/MainAppBottomNav';

type TabId = 'inventory' | 'catalogues' | 'dead' | 'history';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
  :where(.wh-root) *, :where(.wh-root) *::before, :where(.wh-root) *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: rgb(224, 238, 243);
    --card: #fff;
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #64748b;
    --accent: #2563eb;
    --radius: 14px;
    --font: 'DM Sans', system-ui, sans-serif;
  }
  .wh-root {
    min-height: 100dvh;
    background: var(--bg);
    font-family: var(--font);
    padding-top: 40px;
    padding-bottom: 72px;
  }
  .wh-status-bar { position: fixed; inset: 0 0 auto 0; height: 40px; background: #0f172a; z-index: 60; }
  .wh-header {
    position: sticky; top: 40px; z-index: 50;
    background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; height: 52px; padding: 0 8px 0 4px;
  }
  .wh-back { width: 40px; height: 40px; border: none; border-radius: 10px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .wh-back:hover { background: #f1f5f9; }
  .wh-title { flex: 1; text-align: center; font-size: 16px; font-weight: 600; color: var(--text); }
  .wh-spacer { width: 40px; }
  .wh-main { max-width: 520px; margin: 0 auto; padding: 12px 14px 24px; }
  .wh-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 8px; }
  .wh-tab {
    flex-shrink: 0; border: 1px solid var(--border); background: var(--card);
    border-radius: 999px; padding: 7px 14px; font-size: 12.5px; font-weight: 500; color: var(--muted); cursor: pointer;
  }
  .wh-tab.active { background: #0f172a; color: #fff; border-color: #0f172a; }
  .wh-card {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(15,23,42,0.05);
  }
  .wh-lead { font-size: 13px; line-height: 1.5; color: var(--muted); }
  .wh-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .wh-input, .wh-select {
    flex: 1; border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; font-size: 14px; font-family: inherit;
  }
  .wh-btn {
    border: none; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
    background: var(--accent); color: #fff;
  }
  .wh-btn.secondary { background: #f1f5f9; color: var(--text); }
  .wh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .wh-list-item {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 10px 0; border-bottom: 1px solid #f1f5f9;
  }
  .wh-list-item:last-child { border-bottom: none; }
  .wh-room-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 12px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer;
  }
  .wh-room-row:last-child { border-bottom: none; }
  .wh-room-row:hover { background: #f8fafc; margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 10px; }
  .wh-label { font-size: 14px; font-weight: 500; color: var(--text); }
  .wh-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .wh-error { background: #fdf4f3; border: 1px solid #f5c6c2; color: #c0392b; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-bottom: 10px; }
  .wh-spinner { width: 28px; height: 28px; border: 2px solid #e2e8f0; border-top-color: var(--accent); border-radius: 50%; animation: wh-spin 0.7s linear infinite; margin: 32px auto; }
  @keyframes wh-spin { to { transform: rotate(360deg); } }
  .wh-search-wrap { position: relative; margin-bottom: 10px; }
  .wh-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
  .wh-search { width: 100%; padding: 10px 12px 10px 38px; border: 1px solid var(--border); border-radius: 10px; font-size: 14px; font-family: inherit; }
  .wh-product-list { display: flex; flex-direction: column; gap: 10px; }
  .wh-product-group {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,0.04);
  }
  .wh-product-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  }
  .wh-product-header {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px;
    width: 100%; border: none; background: #fff; cursor: pointer; text-align: left;
    font-family: inherit;
  }
  .wh-product-header:active { background: #f8fafc; }
  .wh-product-header.open { border-bottom: 1px solid #f1f5f9; }
  .wh-chevron {
    width: 28px; height: 28px; border-radius: 8px; background: #f1f5f9;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    color: var(--muted); transition: transform 0.2s ease;
  }
  .wh-chevron.open { transform: rotate(180deg); background: #e0e7ff; color: var(--accent); }
  .wh-variant-panel {
    background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
    border-top: 1px solid #eef2f6;
    padding: 6px 0 8px;
  }
  .wh-variant-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px 10px 18px;
    margin: 0 10px 6px;
    background: #fff;
    border: 1px solid #e8edf2;
    border-left: 3px solid var(--accent);
    border-radius: 10px;
  }
  .wh-variant-row:last-child { margin-bottom: 0; }
  .wh-thumb {
    width: 48px; height: 48px; border-radius: 8px; border: 1px solid #e2e8f0;
    background: #f1f5f9; overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .wh-thumb.sm { width: 40px; height: 40px; border-radius: 7px; }
  .wh-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .wh-thumb-placeholder { font-size: 9px; color: #94a3b8; }
  .wh-product-text { flex: 1; min-width: 0; }
  .wh-product-name { font-size: 14px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wh-product-sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
  .wh-variant-meta {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 5px;
    font-size: 11px; font-weight: 600; color: var(--accent);
  }
  .wh-variant-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: #94a3b8; }
  .wh-variant-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    color: #64748b; margin-bottom: 2px;
  }
  .wh-variant-name { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.3; }
  .wh-qty-side { text-align: right; flex-shrink: 0; }
  .wh-qty-side-val { font-size: 15px; font-weight: 700; color: var(--text); line-height: 1.2; }
  .wh-qty-side-lbl { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
  .wh-history-day { margin-bottom: 14px; }
  .wh-history-date {
    font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.06em; padding: 0 4px 8px;
  }
  .wh-history-card {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,0.05);
  }
  .wh-history-card .wh-list-item { padding: 12px 14px; }
  .wh-room-pill {
    display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600; background: #f1f5f9; color: #475569;
    border: 1px solid #e2e8f0; line-height: 1.2;
  }
  .wh-history-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .wh-history-pills .wh-room-pill { margin-top: 0; }
  .wh-variant-pill {
    display: inline-block; padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600; background: #eff6ff; color: #1d4ed8;
    border: 1px solid #bfdbfe; line-height: 1.2;
  }
  .wh-empty { padding: 32px 16px; text-align: center; color: var(--muted); font-size: 14px; }
`;

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function stockLineKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? ''}`;
}

interface WarehouseProduct {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  imageVersion?: number;
  raw: Record<string, unknown>;
}

function loadWarehouseProducts(userId: string | null): WarehouseProduct[] {
  if (!userId) return [];
  const raw = readProductsWithLegacyFallback(userId);
  if (!Array.isArray(raw)) return [];
  return raw.map((p: Record<string, unknown>) => {
    const urls = getProductImageUrls(p);
    const imageUrl = urls[0] ?? String(p.imageUrl ?? p.image ?? '');
    const iv = p.imageVersion ?? p.image_version;
    return {
      id: String(p.id ?? ''),
      name: String(p.name ?? 'Product'),
      subtitle: String(p.subtitle ?? ''),
      imageUrl,
      imageVersion: typeof iv === 'number' && Number.isFinite(iv) ? iv : undefined,
      raw: p,
    };
  });
}

function pickDisplayImage(
  product: WarehouseProduct,
  variantImage?: string
): string {
  const src = variantImage?.trim() || product.imageUrl;
  if (!src) return '';
  return productImageDisplayUrl(src, product.imageVersion);
}

function parseVariantCombinationId(combinationId: string): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const part of combinationId.split('|')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    selections[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return selections;
}

function resolveStockLineLabels(
  productId: string,
  variantCombinationId: string | null | undefined,
  productById: Map<string, WarehouseProduct>
): { productName: string; productSubtitle: string; variantLabel: string } {
  const product = productById.get(productId);
  const productName = product?.name ?? `Product ${productId}`;
  const productSubtitle = product?.subtitle ?? '';

  if (!variantCombinationId || !product) {
    return { productName, productSubtitle, variantLabel: '' };
  }

  const groups = getProductVariantGroups(product.raw);
  const combo = getAllVariantCombinations(groups).find((c) => c.id === variantCombinationId);
  const selections = combo?.selections ?? parseVariantCombinationId(variantCombinationId);
  const variantLabel =
    formatVariantSelectionSummary(groups, selections) ||
    variantCombinationId.replace(/\|/g, ', ');

  return { productName, productSubtitle, variantLabel };
}

function getMovementDateKey(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHistoryDateLabel(dateKey: string): string {
  if (dateKey === 'unknown') return 'Unknown date';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const todayKey = getMovementDateKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getMovementDateKey(yesterday.toISOString());
  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function groupMovementsByDate(movements: InventoryMovement[]): [string, InventoryMovement[]][] {
  const groups = new Map<string, InventoryMovement[]>();
  for (const m of movements) {
    const key = getMovementDateKey(m.createdAt);
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.entries());
}

async function linkCataloguesToMainRoom(userId: string, mainInventoryId: string): Promise<Catalogue[]> {
  const def = getCataloguesDefinition(userId);
  let changed = false;
  const catalogues = def.catalogues.map((c) => {
    if (!c.inventoryId) {
      changed = true;
      return { ...c, inventoryId: mainInventoryId };
    }
    return c;
  });
  if (!changed) return getAllCatalogues();
  const next = { ...def, catalogues, lastUpdated: Date.now() };
  setCataloguesDefinition(next);
  await syncCataloguesDefinition(userId, next).catch(() => undefined);
  return catalogues;
}

export default function WarehousePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const effectiveUid = useMemo(() => user?.uid ?? getPersistedAuthUserId() ?? null, [user?.uid]);

  const [tab, setTab] = useState<TabId>('inventory');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [warehouseName, setWarehouseName] = useState('Default warehouse');
  const [mainInventoryId, setMainInventoryId] = useState('');
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockLine[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const products = useMemo(() => loadWarehouseProducts(effectiveUid), [effectiveUid, loading]);

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

  const movementsByDate = useMemo(() => groupMovementsByDate(movements), [movements]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

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

  const refreshLevels = useCallback(async (roomId: string) => {
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
  }, [effectiveUid]);

  const openRoom = useCallback(
    async (roomId: string) => {
      setActiveRoomId(roomId);
      setProductSearch('');
      setExpandedProductIds(new Set());
      setRoomLoading(true);
      await refreshLevels(roomId);
      setRoomLoading(false);
    },
    [refreshLevels]
  );

  useEffect(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return;
    const toExpand = new Set<string>();
    for (const product of filteredProducts) {
      const groups = getProductVariantGroups(product.raw);
      const combos = groups.length > 0 ? getAllVariantCombinations(groups) : [];
      if (combos.length === 0) continue;
      const nameMatch =
        product.name.toLowerCase().includes(q) ||
        product.subtitle.toLowerCase().includes(q);
      const variantMatch = combos.some((combo) =>
        formatVariantSelectionSummary(groups, combo.selections).toLowerCase().includes(q)
      );
      if (nameMatch || variantMatch) toExpand.add(product.id);
    }
    if (toExpand.size > 0) {
      setExpandedProductIds((prev) => new Set([...prev, ...toExpand]));
    }
  }, [productSearch, filteredProducts]);

  const toggleProductExpanded = useCallback((productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

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
      setMainInventoryId(ensured.data.mainInventoryId);
      const cats = await linkCataloguesToMainRoom(effectiveUid, ensured.data.mainInventoryId);
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

  useEffect(() => {
    return () => {
      for (const t of saveTimersRef.current.values()) clearTimeout(t);
      saveTimersRef.current.clear();
    };
  }, []);

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
      if (!effectiveUid || !activeRoomId) return;
      if (!guardCloudWrite()) return;
      const level = getLevelFor(productId, variantId);
      const res = await adjustInventoryLevel(
        effectiveUid,
        activeRoomId,
        productId,
        onHand,
        variantId,
        level?.lowStockThreshold ?? null
      );
      if (res.error) {
        showToast('Could not save stock', 'error');
        await refreshLevels(activeRoomId);
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
    [effectiveUid, activeRoomId, guardCloudWrite, getLevelFor, showToast, refreshLevels]
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

  const handleAddRoom = async () => {
    if (!effectiveUid || !mainInventoryId || !newRoomName.trim()) return;
    if (!guardCloudWrite()) return;
    setSaving(true);
    const whId = rooms[0]?.warehouseId;
    if (!whId) {
      setSaving(false);
      return;
    }
    const res = await createInventoryRoom(effectiveUid, whId, newRoomName.trim(), rooms.length);
    setSaving(false);
    if (res.error || !res.data) {
      showToast('Could not add inventory', 'error');
      return;
    }
    setRooms((prev) => [...prev, res.data!]);
    setNewRoomName('');
    showToast('Inventory added', 'success');
  };

  const handleRenameRoom = async (room: InventoryRoom, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveUid) return;
    if (!guardCloudWrite()) return;
    const name = window.prompt('Inventory name', room.name);
    if (!name?.trim()) return;
    const res = await updateInventoryRoom(effectiveUid, room.id, { name: name.trim() });
    if (res.error) {
      showToast('Rename failed', 'error');
      return;
    }
    setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, name: name.trim() } : r)));
  };

  const handleCatalogueLink = async (catalogueId: string, inventoryId: string) => {
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
  };

  const renderQtyStepper = (productId: string, variantId: string | null) => (
    <WarehouseQtyStepper
      value={getQty(productId, variantId)}
      disabled={saving}
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
              <span>{combos.length} variant{combos.length === 1 ? '' : 's'}</span>
              <span className="wh-variant-meta-dot" />
              <span>{totalStock} in stock</span>
            </div>
          </div>
        </button>

        {isOpen ? (
          <div className="wh-variant-panel">
            {combos.map((combo) => {
              const variantData = getVariantCombinationData(product.raw, combo.selections);
              const variantLabel = formatVariantSelectionSummary(groups, combo.selections) || 'Variant';
              const variantSrc = pickDisplayImage(product, variantData?.image ?? product.imageUrl);
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

  const renderRoomStockView = () => {
    if (roomLoading) {
      return <div className="wh-spinner" />;
    }

    return (
      <>
        <div className="wh-search-wrap">
          <FiSearch className="wh-search-icon" size={18} />
          <input
            className="wh-search"
            placeholder="Search products…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
        </div>
        {filteredProducts.length === 0 ? (
          <div className="wh-card wh-empty">
            {productSearch ? 'No products match your search.' : 'No products yet.'}
          </div>
        ) : (
          <div className="wh-product-list">
            {filteredProducts.map((product) => {
              const groups = getProductVariantGroups(product.raw);
              const combos =
                groups.length > 0 ? getAllVariantCombinations(groups) : [];

              if (combos.length === 0) {
                return renderSimpleProductRow(product);
              }

              return renderVariantProductGroup(product, combos);
            })}
          </div>
        )}
      </>
    );
  };

  const headerTitle = activeRoom ? activeRoom.name : 'Warehouse';
  const handleHeaderBack = () => {
    if (activeRoomId) {
      setActiveRoomId(null);
      setProductSearch('');
      return;
    }
    navigate(-1);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="wh-root">
        <div className="wh-status-bar" />
        <header className="wh-header">
          <button type="button" className="wh-back" aria-label="Back" onClick={handleHeaderBack}>
            <IconBack />
          </button>
          <h1 className="wh-title">{headerTitle}</h1>
          <div className="wh-spacer" />
        </header>

        <main className="wh-main">
          {loading && !activeRoomId ? (
            <div className="wh-spinner" />
          ) : activeRoomId ? (
            <>
              {error ? <div className="wh-error">{error}</div> : null}
              {renderRoomStockView()}
            </>
          ) : (
            <>
              {error ? <div className="wh-error">{error}</div> : null}
              <div className="wh-card">
                <div className="wh-label">{warehouseName}</div>
                <p className="wh-lead" style={{ marginTop: 4 }}>
                  Select an inventory to set stock for each product. Variants appear as sub-lines with their own quantity.
                </p>
              </div>

              <div className="wh-tabs">
                {(['inventory', 'catalogues', 'dead', 'history'] as TabId[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`wh-tab${tab === t ? ' active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'inventory' ? 'Inventory' : t === 'catalogues' ? 'Catalogues' : t === 'dead' ? 'Dead stock' : 'History'}
                  </button>
                ))}
              </div>

              {tab === 'inventory' ? (
                <div className="wh-card">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="wh-room-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => void openRoom(room.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void openRoom(room.id);
                        }
                      }}
                    >
                      <div>
                        <div className="wh-label">{room.name}</div>
                        {room.id === mainInventoryId ? <div className="wh-sub">Default inventory</div> : null}
                      </div>
                      <button
                        type="button"
                        className="wh-btn secondary"
                        onClick={(e) => handleRenameRoom(room, e)}
                      >
                        Rename
                      </button>
                    </div>
                  ))}
                  <div className="wh-row" style={{ marginTop: 12 }}>
                    <input
                      className="wh-input"
                      placeholder="New inventory name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                    />
                    <button type="button" className="wh-btn" disabled={saving} onClick={handleAddRoom}>
                      Add
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === 'catalogues' ? (
                <div className="wh-card">
                  {catalogues.map((cat) => (
                    <div key={cat.id} className="wh-list-item">
                      <div className="wh-label">{cat.label}</div>
                      <select
                        className="wh-select"
                        style={{ maxWidth: 160 }}
                        value={cat.inventoryId ?? ''}
                        onChange={(e) => handleCatalogueLink(cat.id, e.target.value)}
                      >
                        <option value="">None</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'dead' ? (
                <div className="wh-card">
                  {deadStock.length === 0 ? (
                    <p className="wh-lead">No unsellable stock in unlinked inventories.</p>
                  ) : (
                    deadStock.map((line, i) => {
                      const { productName, productSubtitle, variantLabel } = resolveStockLineLabels(
                        line.productId,
                        line.variantCombinationId,
                        productById
                      );
                      return (
                        <div key={`${line.inventoryId}-${line.productId}-${i}`} className="wh-list-item">
                          <div style={{ minWidth: 0 }}>
                            <div className="wh-label">{productName}</div>
                            {productSubtitle ? <div className="wh-sub">{productSubtitle}</div> : null}
                            <div className="wh-history-pills">
                              {variantLabel ? (
                                <span className="wh-variant-pill">{variantLabel}</span>
                              ) : null}
                              <span className="wh-room-pill">{line.inventoryName}</span>
                            </div>
                          </div>
                          <div className="wh-qty-side">
                            <div className="wh-qty-side-val">{line.onHand}</div>
                            <div className="wh-qty-side-lbl">units</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}

              {tab === 'history' ? (
                movements.length === 0 ? (
                  <div className="wh-card">
                    <p className="wh-lead">No movements yet.</p>
                  </div>
                ) : (
                  <div>
                    {movementsByDate.map(([dateKey, dayMovements]) => (
                      <div key={dateKey} className="wh-history-day">
                        <div className="wh-history-date">{formatHistoryDateLabel(dateKey)}</div>
                        <div className="wh-history-card">
                          {dayMovements.map((m) => {
                            const { productName, productSubtitle, variantLabel } = resolveStockLineLabels(
                              m.productId,
                              m.variantCombinationId,
                              productById
                            );
                            const roomName = roomNameById.get(m.inventoryId) ?? 'Inventory';
                            return (
                              <div key={m.id} className="wh-list-item">
                                <div style={{ minWidth: 0 }}>
                                  <div className="wh-label">{productName}</div>
                                  {productSubtitle ? <div className="wh-sub">{productSubtitle}</div> : null}
                                  <div className="wh-history-pills">
                                    {variantLabel ? (
                                      <span className="wh-variant-pill">{variantLabel}</span>
                                    ) : null}
                                    <span className="wh-room-pill">{roomName}</span>
                                  </div>
                                </div>
                                <div className="wh-qty-side">
                                  <div
                                    className="wh-qty-side-val"
                                    style={{ color: m.delta < 0 ? '#c0392b' : '#1a7a4a' }}
                                  >
                                    {m.delta > 0 ? '+' : ''}{m.delta}
                                  </div>
                                  <div className="wh-qty-side-lbl">change</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : null}
            </>
          )}
        </main>

        <MainAppBottomNav active="products" />
      </div>
    </>
  );
}
