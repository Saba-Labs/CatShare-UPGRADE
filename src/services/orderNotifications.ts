import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import { fetchSellerOrders, type Order } from './orderService';
import { PUSH_REGISTERED_STORAGE_KEY } from './pushTokenService';

const ORDERS_CHANNEL_ID = 'catshare_new_orders';

/** Dedupe realtime + polling firing for the same order id. */
const recentlyHandledOrderIds = new Set<string>();
const DEDUPE_MS = 5 * 60 * 1000;

function parseRowToOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id ?? ''),
    share_link_token: String(row.share_link_token ?? ''),
    seller_user_id: String(row.seller_user_id ?? ''),
    customer_name: String(row.customer_name ?? ''),
    customer_whatsapp: row.customer_whatsapp != null ? String(row.customer_whatsapp) : undefined,
    items: (Array.isArray(row.items) ? row.items : []) as Order['items'],
    total_amount: row.total_amount != null ? Number(row.total_amount) : undefined,
    currency_code: String(row.currency_code ?? 'INR'),
    status: row.status as Order['status'],
    order_source: row.order_source as Order['order_source'],
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function sellerIdsMatch(a: string, b: string): boolean {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function shouldNotifyForOrder(order: Pick<Order, 'order_source'>): boolean {
  return order.order_source !== 'manual';
}

function getCurrencySymbol(code?: string): string {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return '₹';
}

function formatNotificationBody(order: Order): string {
  const name = order.customer_name?.trim() || 'Customer';
  if (order.total_amount != null && Number.isFinite(order.total_amount)) {
    const sym = getCurrencySymbol(order.currency_code);
    const amt = order.total_amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${name} · ${sym}${amt}`;
  }
  const n = (order.items || []).length;
  return `${name} · ${n} item${n === 1 ? '' : 's'}`;
}

/**
 * Show a system notification for a new order (native: local notification; web: Notification API if permitted).
 */
export async function showNewOrderNotification(order: Order): Promise<void> {
  const title = 'New order received';
  const body = formatNotificationBody(order);
  const isNative = Capacitor.getPlatform() !== 'web';

  if (isNative) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        console.warn('[CatShare] Local notifications not granted:', perm.display);
        return;
      }
      await LocalNotifications.createChannel({
        id: ORDERS_CHANNEL_ID,
        name: 'New orders',
        description: 'Alerts when a customer places an order',
        importance: 5,
        visibility: 1,
      });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 0x7fffffff),
            title,
            body,
            channelId: ORDERS_CHANNEL_ID,
            extra: { orderId: order.id },
          },
        ],
      });
    } catch (e) {
      console.warn('Could not show new-order notification:', e);
    }
    return;
  }

  if (typeof Notification === 'undefined') return;

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return;
    }
  }

  if (permission === 'granted') {
    try {
      new Notification(title, { body, tag: `order-${order.id}` });
    } catch (e) {
      console.warn('Could not show web notification for new order:', e);
    }
  }
}

function setRealtimeAuthFromSession(session: Session | null): void {
  const client = getSupabaseClient();
  try {
    client.realtime.setAuth(session?.access_token ?? null);
  } catch (e) {
    console.warn('[CatShare] realtime.setAuth failed:', e);
  }
}

/** When FCM token is saved, server sends push for new orders; skip in-app local notification to avoid duplicates. */
function shouldSkipLocalNotificationBecauseFcm(): boolean {
  if (Capacitor.getPlatform() === 'web') return false;
  try {
    return localStorage.getItem(PUSH_REGISTERED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function emitNewOrderIfEligible(
  order: Order,
  _source: 'realtime' | 'poll',
  options?: { onNewOrder?: (order: Order) => void }
): void {
  if (recentlyHandledOrderIds.has(order.id)) return;
  if (!shouldNotifyForOrder(order)) return;

  recentlyHandledOrderIds.add(order.id);
  window.setTimeout(() => recentlyHandledOrderIds.delete(order.id), DEDUPE_MS);

  if (!shouldSkipLocalNotificationBecauseFcm()) {
    void showNewOrderNotification(order);
  }
  options?.onNewOrder?.(order);
  try {
    window.dispatchEvent(
      new CustomEvent('catshareNewOrder', { detail: { orderId: order.id, order } })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Poll REST for new orders. Reliable when Realtime/RLS/WebSocket does not deliver postgres_changes.
 */
export function startPollingForNewSellerOrders(
  sellerUserId: string,
  options?: { onNewOrder?: (order: Order) => void; pollIntervalMs?: number }
): () => void {
  const pollMs = options?.pollIntervalMs ?? 12000;
  let baselineReady = false;
  let knownIds = new Set<string>();

  const tick = async () => {
    try {
      const { data, error } = await fetchSellerOrders(sellerUserId);
      if (error || !data) return;

      if (!baselineReady) {
        knownIds = new Set(data.map((o) => o.id));
        baselineReady = true;
        return;
      }

      const nextKnown = new Set(data.map((o) => o.id));
      for (const o of data) {
        if (!knownIds.has(o.id)) {
          emitNewOrderIfEligible(o, 'poll', options);
        }
      }
      knownIds = nextKnown;
    } catch (e) {
      console.warn('[CatShare] order poll failed:', e);
    }
  };

  void tick();
  const intervalId = window.setInterval(() => void tick(), pollMs);

  const onVis = () => {
    if (document.visibilityState === 'visible') void tick();
  };
  document.addEventListener('visibilitychange', onVis);

  let appListener: { remove: () => Promise<void> } | undefined;
  if (Capacitor.isNativePlatform()) {
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void tick();
    }).then((h) => {
      appListener = h;
    });
  }

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVis);
    void appListener?.remove();
  };
}

/**
 * Subscribe to INSERT on `orders` (best-effort; polling covers gaps).
 */
export async function subscribeToNewSellerOrders(
  sellerUserId: string,
  options?: { onNewOrder?: (order: Order) => void }
): Promise<() => void> {
  const client = getSupabaseClient();

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.access_token) {
    console.warn('[CatShare] Orders realtime: no session — skipping subscription');
    return () => {};
  }

  setRealtimeAuthFromSession(session);

  try {
    await client.realtime.connect();
  } catch {
    /* optional */
  }

  if (Capacitor.getPlatform() !== 'web') {
    try {
      await LocalNotifications.requestPermissions();
    } catch {
      /* non-fatal */
    }
  }

  const channel: RealtimeChannel = client
    .channel(`seller-orders-${sellerUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (!sellerIdsMatch(String(row.seller_user_id ?? ''), sellerUserId)) return;

        const order = parseRowToOrder(row);
        emitNewOrderIfEligible(order, 'realtime', options);
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[CatShare] Orders realtime: subscribed');
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Seller orders realtime subscription:', status, err?.message ?? err);
      }
    });

  const onAuthChange = (_event: AuthChangeEvent, newSession: Session | null) => {
    setRealtimeAuthFromSession(newSession);
  };
  const {
    data: { subscription: authSub },
  } = client.auth.onAuthStateChange(onAuthChange);

  return () => {
    authSub.unsubscribe();
    void client.removeChannel(channel);
  };
}
