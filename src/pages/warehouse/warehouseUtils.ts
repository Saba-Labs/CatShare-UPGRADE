import { readProductsWithLegacyFallback } from '../../utils/safeStorage';
import { productImageDisplayUrl } from '../../utils/imageUrl';
import { getProductImageUrls } from '../../utils/productImages';
import type { InventoryMovement } from '../../types/inventory';
import {
  formatVariantSelectionSummary,
  getAllVariantCombinations,
  getProductVariantGroups,
} from '../../utils/productVariants';

export function stockLineKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? ''}`;
}

export interface WarehouseProduct {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  imageVersion?: number;
  raw: Record<string, unknown>;
}

export function loadWarehouseProducts(userId: string | null): WarehouseProduct[] {
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

export function pickDisplayImage(
  product: WarehouseProduct,
  variantImage?: string
): string {
  const src = variantImage?.trim() || product.imageUrl;
  if (!src) return '';
  return productImageDisplayUrl(src, product.imageVersion);
}

export function parseVariantCombinationId(combinationId: string): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const part of combinationId.split('|')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    selections[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return selections;
}

export function resolveStockLineLabels(
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

export function getMovementDateKey(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatHistoryDateLabel(dateKey: string): string {
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

export function groupMovementsByDate(movements: InventoryMovement[]): [string, InventoryMovement[]][] {
  const groups = new Map<string, InventoryMovement[]>();
  for (const m of movements) {
    const key = getMovementDateKey(m.createdAt);
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.entries());
}

export interface CardAccent {
  bg: string;
  border: string;
  icon: string;
  stripe: string;
}

const CARD_ACCENTS: CardAccent[] = [
  { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', stripe: '#3b82f6' },
  { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', stripe: '#22c55e' },
  { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', stripe: '#f59e0b' },
  { bg: '#faf5ff', border: '#e9d5ff', icon: '#9333ea', stripe: '#a855f7' },
  { bg: '#fff1f2', border: '#fecdd3', icon: '#e11d48', stripe: '#f43f5e' },
  { bg: '#ecfeff', border: '#a5f3fc', icon: '#0891b2', stripe: '#06b6d4' },
];

export function getCardAccent(key: string, fallbackIndex = 0): CardAccent {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 9973;
  }
  const index = (hash + fallbackIndex) % CARD_ACCENTS.length;
  return CARD_ACCENTS[index];
}
