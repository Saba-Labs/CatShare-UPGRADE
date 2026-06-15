import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { fetchLowStockLevels } from './inventoryService';
import type { InventoryLevel } from '../types/inventory';

const LOW_STOCK_CHANNEL_ID = 'catshare_low_stock';
const DEDUPE_MS = 24 * 60 * 60 * 1000;
const recentlyNotified = new Map<string, number>();

function levelKey(level: InventoryLevel): string {
  return `${level.inventoryId}::${level.productId}::${level.variantCombinationId ?? ''}`;
}

function shouldNotify(level: InventoryLevel): boolean {
  const key = levelKey(level);
  const last = recentlyNotified.get(key);
  if (last && Date.now() - last < DEDUPE_MS) return false;
  recentlyNotified.set(key, Date.now());
  return true;
}

export async function showLowStockNotification(level: InventoryLevel): Promise<void> {
  if (!shouldNotify(level)) return;

  const title = 'Low stock alert';
  const variant = level.variantCombinationId ? ` (${level.variantCombinationId})` : '';
  const body = `${level.productId}${variant}: ${level.onHand} left`;
  const isNative = Capacitor.getPlatform() !== 'web';

  if (isNative) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;
      await LocalNotifications.createChannel({
        id: LOW_STOCK_CHANNEL_ID,
        name: 'Low stock',
        importance: 4,
        visibility: 1,
      });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1_000_000),
            title,
            body,
            channelId: LOW_STOCK_CHANNEL_ID,
          },
        ],
      });
    } catch {
      // ignore
    }
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // ignore
    }
  }
}

export async function pollLowStockForSeller(userId: string): Promise<void> {
  const { data } = await fetchLowStockLevels(userId);
  for (const level of data ?? []) {
    await showLowStockNotification(level);
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startPollingForLowStock(userId: string): () => void {
  if (pollTimer) clearInterval(pollTimer);
  void pollLowStockForSeller(userId);
  pollTimer = setInterval(() => {
    void pollLowStockForSeller(userId);
  }, 60_000);
  return () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
