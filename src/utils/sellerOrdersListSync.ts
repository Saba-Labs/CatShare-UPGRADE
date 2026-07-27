import type { Order } from '../services/orderService';
import {
  patchCachedOrder,
  readCachedOrderById,
  removeCachedOrder,
  upsertCachedOrder,
} from './storePageCache';

const runtimeOrdersMemory = new Map<string, { updatedAt: number; orders: Order[] }>();

export function getRuntimeSellerOrders(uid: string) {
  return runtimeOrdersMemory.get(uid);
}

export function setRuntimeSellerOrders(uid: string, orders: Order[]) {
  runtimeOrdersMemory.set(uid, { updatedAt: Date.now(), orders });
}

function mergeOrderIntoRuntime(uid: string, order: Order): void {
  const mem = runtimeOrdersMemory.get(uid);
  if (!mem?.orders?.length) return;
  const idx = mem.orders.findIndex((o) => o.id === order.id);
  const next = [...mem.orders];
  if (idx >= 0) next[idx] = { ...next[idx], ...order };
  else next.unshift(order);
  next.sort(
    (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  );
  runtimeOrdersMemory.set(uid, { updatedAt: Date.now(), orders: next });
}

function removeOrderFromRuntime(uid: string, orderId: string): void {
  const mem = runtimeOrdersMemory.get(uid);
  if (!mem?.orders?.length) return;
  const next = mem.orders.filter((o) => o.id !== orderId);
  runtimeOrdersMemory.set(uid, { updatedAt: Date.now(), orders: next });
}

/** Keep orders list + runtime cache in sync after detail-page edits. */
export function notifySellerOrderUpdated(uid: string, order: Order): void {
  upsertCachedOrder(uid, order);
  mergeOrderIntoRuntime(uid, order);
  try {
    window.dispatchEvent(
      new CustomEvent('catshareNewOrder', { detail: { orderId: order.id, order } })
    );
  } catch {
    /* ignore */
  }
}

export function notifySellerOrderPatched(
  uid: string,
  orderId: string,
  patch: Partial<Order>
): void {
  patchCachedOrder(uid, orderId, patch);
  const merged = readCachedOrderById(uid, orderId);
  if (merged) notifySellerOrderUpdated(uid, merged);
}

export function notifySellerOrderRemoved(uid: string, orderId: string): void {
  removeCachedOrder(uid, orderId);
  removeOrderFromRuntime(uid, orderId);
  try {
    window.dispatchEvent(new CustomEvent('catshareOrderRemoved', { detail: { orderId } }));
  } catch {
    /* ignore */
  }
}
