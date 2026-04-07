import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';
import type { Order } from './orderService';

const ORDERS_CHANNEL_ID = 'catshare_new_orders';

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

/** Customer-originated orders only (skip seller-created manual entries). */
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

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `order-${order.id}` });
    } catch (e) {
      console.warn('Could not show web notification for new order:', e);
    }
  }
}

/**
 * Subscribe to new rows in `orders` for this seller. Requires Realtime enabled on `orders` and
 * RLS that allows SELECT via JWT (see SUPABASE_ORDERS_SQL.md).
 */
export function subscribeToNewSellerOrders(
  sellerUserId: string,
  options?: { onNewOrder?: (order: Order) => void }
): () => void {
  const client = getSupabaseClient();
  const channel: RealtimeChannel = client
    .channel(`seller-orders-${sellerUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `seller_user_id=eq.${sellerUserId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const order = parseRowToOrder(row);
        if (!shouldNotifyForOrder(order)) return;
        void showNewOrderNotification(order);
        options?.onNewOrder?.(order);
        try {
          window.dispatchEvent(
            new CustomEvent('catshareNewOrder', { detail: { orderId: order.id, order } })
          );
        } catch {
          /* ignore */
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Seller orders realtime subscription:', status, err?.message ?? err);
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
