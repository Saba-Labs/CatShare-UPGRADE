import { getPersistedAuthUserId } from "./authUserId";
import { syncQueue } from "../services/syncQueue";
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
  productName?: string;
  exactProductChanges?: boolean;
  exactBulkChanges?: boolean;
  changes: ProductHistoryChange[];
  omittedChangeCount?: number;
};

const MAX_ENTRIES_PER_PRODUCT = 20;
const MAX_CHANGES_PER_ENTRY = 50;
const MAX_HISTORY_SYNC_BATCH_SIZE = 100;

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

export function areProductHistoryValuesEqual(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true;
  const isEmpty = (value: unknown) =>
    value == null || value === "" || (Array.isArray(value) && value.length === 0);
  if (isEmpty(before) && isEmpty(after)) return true;
  if (
    ["string", "number"].includes(typeof before) &&
    ["string", "number"].includes(typeof after)
  ) {
    return String(before) === String(after);
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.length === after.length && before.every((value, index) => areProductHistoryValuesEqual(value, after[index]));
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const beforeKeys = Object.keys(before).sort();
    const afterKeys = Object.keys(after).sort();
    return beforeKeys.length === afterKeys.length && beforeKeys.every(
      (key, index) => key === afterKeys[index] && areProductHistoryValuesEqual(before[key], after[key])
    );
  }
  return false;
}

const PRODUCT_PRESENTATION_HISTORY_FIELDS = [
  "imageUrl",
  "imageUrls",
  "primaryImageIndex",
  "videoUrls",
  "variants",
  "suggestedColors",
  "fontColor",
  "imageBgColor",
  "bgColor",
  "cropAspectRatio",
];

export function createProductEditHistoryChanges(
  beforeForm: unknown,
  afterForm: unknown,
  beforeProduct: unknown,
  afterProduct: unknown
): ProductHistoryChange[] {
  const projectPresentation = (product: unknown) => {
    if (!isPlainObject(product)) return {};
    return Object.fromEntries(
      PRODUCT_PRESENTATION_HISTORY_FIELDS.map((field) => [field, product[field]])
    );
  };
  return [
    ...collectChanges(beforeForm, afterForm),
    ...collectChanges(projectPresentation(beforeProduct), projectPresentation(afterProduct)),
  ];
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
  if (areProductHistoryValuesEqual(before, after)) return changes;

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

export function readAllProductHistory(userId: string): ProductHistoryEntry[] {
  const prefix = `productHistory::${userId}::`;
  const entries: ProductHistoryEntry[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const stored = safeGetFromStorage<unknown>(key, []);
      if (!Array.isArray(stored)) continue;
      stored.forEach((entry) => {
        if (
          isPlainObject(entry) &&
          typeof entry.id === "string" &&
          typeof entry.productId === "string" &&
          typeof entry.timestamp === "string" &&
          Array.isArray(entry.changes)
        ) {
          entries.push(entry as unknown as ProductHistoryEntry);
        }
      });
    }
  } catch {
    return entries;
  }
  return entries;
}

export function queueLocalProductHistoryBackfill(userId: string): void {
  const marker = `productHistoryCloudBackfill::${userId}`;
  try {
    const entries = readAllProductHistory(userId);
    if (localStorage.getItem(marker) === "true") {
      const failedIds = new Set(
        syncQueue.getQueue()
          .filter((item) => item.type === "productHistory" && item.userId === userId && item.status === "failed")
          .flatMap((item) => Array.isArray(item.data) ? item.data.map((entry: ProductHistoryEntry) => entry.id) : [])
      );
      if (failedIds.size > 0) {
        queueProductHistorySync(userId, entries.filter((entry) => failedIds.has(entry.id)));
      }
      return;
    }
    queueProductHistorySync(userId, entries);
    localStorage.setItem(marker, "true");
  } catch {
    return;
  }
}

export function queueProductHistorySync(
  userId: string | undefined,
  entries: ProductHistoryEntry[]
): void {
  const ownerId = userId || getPersistedAuthUserId();
  if (
    !ownerId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId) ||
    entries.length === 0
  ) return;

  const queuedIds = new Set(
    syncQueue.getQueue()
      .filter((item) => item.type === "productHistory" && item.userId === ownerId && item.status !== "failed")
      .flatMap((item) => Array.isArray(item.data) ? item.data.map((entry: ProductHistoryEntry) => entry.id) : [])
  );
  const pendingEntries = entries.filter((entry) => !queuedIds.has(entry.id));
  for (let index = 0; index < pendingEntries.length; index += MAX_HISTORY_SYNC_BATCH_SIZE) {
    syncQueue.addToQueue(
      "productHistory",
      ownerId,
      pendingEntries.slice(index, index + MAX_HISTORY_SYNC_BATCH_SIZE)
    );
  }
}

export function mergeProductHistory(
  userId: string | undefined,
  productId: string,
  incomingEntries: ProductHistoryEntry[]
): ProductHistoryEntry[] {
  const entriesById = new Map<string, ProductHistoryEntry>();
  [...readProductHistory(userId, productId), ...incomingEntries].forEach((entry) => {
    if (entry.productId === String(productId) && !entriesById.has(entry.id)) {
      entriesById.set(entry.id, entry);
    }
  });
  const merged = Array.from(entriesById.values())
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id))
    .slice(0, MAX_ENTRIES_PER_PRODUCT);
  const saved = safeSetInStorage(historyKey(userId, productId), merged);
  if (saved) {
    window.dispatchEvent(new CustomEvent("product-history-changed", { detail: { productId: String(productId) } }));
  }
  return merged;
}

export function recordProductHistory({
  userId,
  productId,
  before,
  after,
  source = "product",
  affectedProductCount,
  changesOverride,
  timestamp = new Date().toISOString(),
  eventId,
}: {
  userId?: string;
  productId: string;
  before: unknown;
  after: unknown;
  source?: ProductHistoryEntry["source"];
  affectedProductCount?: number;
  changesOverride?: ProductHistoryChange[];
  timestamp?: string;
  eventId?: string;
}): void {
  if (productId == null || String(productId).length === 0) return;
  const changes = source === "created"
    ? []
    : changesOverride?.map((change) => ({
        path: change.path,
        before: historySnapshot(change.before),
        after: historySnapshot(change.after),
      })) ?? collectChanges(before, after);
  if (source !== "created" && changes.length === 0) return;

  const entry: ProductHistoryEntry = {
    id: eventId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    productId: String(productId),
    timestamp,
    source,
    ...(source === "bulk" && affectedProductCount ? { affectedProductCount } : {}),
    ...(isPlainObject(after) && typeof after.name === "string" ? { productName: after.name } : {}),
    ...(source === "product" ? { exactProductChanges: true } : {}),
    ...(source === "bulk" ? { exactBulkChanges: true } : {}),
    changes: changes.slice(0, MAX_CHANGES_PER_ENTRY),
    ...(changes.length > MAX_CHANGES_PER_ENTRY
      ? { omittedChangeCount: changes.length - MAX_CHANGES_PER_ENTRY }
      : {}),
  };
  const key = historyKey(userId, String(productId));
  const saved = safeSetInStorage(key, [entry, ...readProductHistory(userId, String(productId))].slice(0, MAX_ENTRIES_PER_PRODUCT));
  if (saved) {
    queueProductHistorySync(userId, [entry]);
    window.dispatchEvent(new CustomEvent("product-history-changed", { detail: { productId: String(productId) } }));
  }
}

export function recordBulkProductHistory(
  userId: string | undefined,
  beforeProducts: unknown[],
  afterProducts: unknown[],
  changesByProduct?: Map<string, ProductHistoryChange[]>
): void {
  const beforeById = new Map(beforeProducts.map((product: any) => [String(product?.id), product]));
  const updated = afterProducts.filter((product: any) => {
    const productId = String(product?.id);
    const before = beforeById.get(productId);
    const changes = changesByProduct?.get(productId);
    return before !== undefined && (changesByProduct ? Boolean(changes?.length) : collectChanges(before, product).length > 0);
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
      changesOverride: changesByProduct?.get(String(after.id)),
      timestamp,
      eventId,
    });
  });
}
