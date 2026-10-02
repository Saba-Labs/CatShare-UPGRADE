import { getPersistedAuthUserId } from "./authUserId";
import { safeGetFromStorage, safeSetInStorage } from "./safeStorage";

export type ProductHistoryChange = {
  path: string;
  before: unknown;
  after: unknown;
};

export type ProductHistoryEntry = {
  id: string;
  productId: string;
  timestamp: string;
  source: "created" | "product" | "variants" | "bulk";
  affectedProductCount?: number;
  changes: ProductHistoryChange[];
  omittedChangeCount?: number;
};

const MAX_ENTRIES_PER_PRODUCT = 40;
const MAX_CHANGES_PER_ENTRY = 30;

function historyKey(userId: string | undefined, productId: string): string {
  const ownerId = userId || getPersistedAuthUserId() || "local";
  return `productHistory::${ownerId}::${encodeURIComponent(productId)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function historySnapshot(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[image data]";
    return value.length > 240 ? `${value.slice(0, 237)}…` : value;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 12).map(historySnapshot);
    if (value.length > 12) items.push(`…${value.length - 12} more`);
    return items;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).slice(0, 12).map(([key, item]) => [key, historySnapshot(item)])
    );
  }
  return value;
}

function arrayItemKey(value: unknown, index: number): string {
  if (isPlainObject(value)) {
    const identity = value.name ?? value.id ?? value.sku ?? value.key;
    if (identity != null && String(identity).length > 0) return String(identity);
  }
  return String(index);
}

function collectChanges(before: unknown, after: unknown, path = "", changes: ProductHistoryChange[] = []): ProductHistoryChange[] {
  if (changes.length >= MAX_CHANGES_PER_ENTRY + 1) return changes;
  if (Object.is(before, after)) return changes;

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (!path && ["id", "createdAt", "updatedAt", "imageBase64", "renderedImages"].includes(key)) continue;
      collectChanges(before[key], after[key], path ? `${path}.${key}` : key, changes);
      if (changes.length >= MAX_CHANGES_PER_ENTRY + 1) break;
    }
    return changes;
  }

  if (Array.isArray(before) && Array.isArray(after) && before.every(isPlainObject) && after.every(isPlainObject)) {
    const beforeMap = new Map(before.map((item, index) => [arrayItemKey(item, index), item]));
    const afterMap = new Map(after.map((item, index) => [arrayItemKey(item, index), item]));
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    for (const key of keys) {
      collectChanges(beforeMap.get(key), afterMap.get(key), `${path}[${key}]`, changes);
      if (changes.length >= MAX_CHANGES_PER_ENTRY + 1) break;
    }
    const beforeOrder = before.map((item, index) => arrayItemKey(item, index));
    const afterOrder = after.map((item, index) => arrayItemKey(item, index));
    if (
      changes.length < MAX_CHANGES_PER_ENTRY + 1 &&
      beforeOrder.length === afterOrder.length &&
      beforeOrder.some((key, index) => key !== afterOrder[index])
    ) {
      changes.push({ path: `${path}.order`, before: historySnapshot(beforeOrder), after: historySnapshot(afterOrder) });
    }
    return changes;
  }

  if (Array.isArray(before) && Array.isArray(after) && before.every((item) => !isPlainObject(item)) && after.every((item) => !isPlainObject(item))) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ path, before: historySnapshot(before), after: historySnapshot(after) });
    }
    return changes;
  }

  if (JSON.stringify(before) !== JSON.stringify(after)) {
    changes.push({ path, before: historySnapshot(before), after: historySnapshot(after) });
  }
  return changes;
}

export function readProductHistory(userId: string | undefined, productId: string): ProductHistoryEntry[] {
  const entries = safeGetFromStorage<ProductHistoryEntry[]>(historyKey(userId, productId), []);
  return Array.isArray(entries) ? entries : [];
}

export function recordProductHistory({
  userId,
  productId,
  before,
  after,
  source = "product",
  affectedProductCount,
  timestamp = new Date().toISOString(),
  eventId,
}: {
  userId?: string;
  productId: string;
  before: unknown;
  after: unknown;
  source?: ProductHistoryEntry["source"];
  affectedProductCount?: number;
  timestamp?: string;
  eventId?: string;
}): void {
  if (productId == null || String(productId).length === 0) return;
  const changes = source === "created" ? [] : collectChanges(before, after);
  if (source !== "created" && changes.length === 0) return;

  const entry: ProductHistoryEntry = {
    id: eventId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    productId: String(productId),
    timestamp,
    source,
    ...(source === "bulk" && affectedProductCount ? { affectedProductCount } : {}),
    changes: changes.slice(0, MAX_CHANGES_PER_ENTRY),
    ...(changes.length > MAX_CHANGES_PER_ENTRY
      ? { omittedChangeCount: changes.length - MAX_CHANGES_PER_ENTRY }
      : {}),
  };
  const key = historyKey(userId, String(productId));
  safeSetInStorage(key, [entry, ...readProductHistory(userId, String(productId))].slice(0, MAX_ENTRIES_PER_PRODUCT));
  window.dispatchEvent(new CustomEvent("product-history-changed", { detail: { productId: String(productId) } }));
}

export function recordBulkProductHistory(
  userId: string | undefined,
  beforeProducts: unknown[],
  afterProducts: unknown[]
): void {
  const beforeById = new Map(beforeProducts.map((product: any) => [String(product?.id), product]));
  const updated = afterProducts.filter((product: any) => {
    const before = beforeById.get(String(product?.id));
    return before !== undefined && collectChanges(before, product).length > 0;
  });
  const timestamp = new Date().toISOString();
  const eventId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  updated.forEach((after: any) => {
    recordProductHistory({
      userId,
      productId: String(after.id),
      before: beforeById.get(String(after.id)),
      after,
      source: "bulk",
      affectedProductCount: updated.length,
      timestamp,
      eventId,
    });
  });
}
