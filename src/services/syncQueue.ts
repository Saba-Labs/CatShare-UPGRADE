/**
 * Offline Sync Queue Service
 * Queues sync operations when offline and retries when back online
 * Ensures no data loss due to network issues
 */

import {
  syncProducts,
  syncDeletedProducts,
  syncCataloguesDefinition,
  syncFieldsDefinition,
  syncUserSettings,
} from './supabaseSync';

export type SyncQueueItemType =
  | 'products'
  | 'deletedProducts'
  | 'cataloguesDefinition'
  | 'fieldsDefinition'
  | 'userSettings';

export interface SyncQueueItem {
  id: string;
  type: SyncQueueItemType;
  userId: string;
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'succeeded' | 'failed';
  error?: string;
}

class OfflineSyncQueue {
  private queue: Map<string, SyncQueueItem> = new Map();
  private isOnline: boolean = navigator.onLine;
  private isProcessing: boolean = false;
  private retryInterval: NodeJS.Timeout | null = null;
  private readonly STORAGE_KEY = 'supabase-sync-queue';
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.loadQueueFromStorage();
    this.setupOnlineOfflineListeners();
    this.startRetryInterval();
  }

  /**
   * Add item to sync queue
   */
  addToQueue(
    type: SyncQueueItemType,
    userId: string,
    data: any
  ): string {
    const id = `${type}-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const item: SyncQueueItem = {
      id,
      type,
      userId,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: this.MAX_RETRIES,
      status: 'pending',
    };

    this.queue.set(id, item);
    this.saveQueueToStorage();

    console.log(`📤 Added to sync queue: ${type} (${id})`);
    this.dispatchQueueChangeEvent();

    // Try to sync immediately if online
    if (this.isOnline && !this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Remove item from queue
   */
  removeFromQueue(id: string): void {
    this.queue.delete(id);
    this.saveQueueToStorage();
    this.dispatchQueueChangeEvent();
    console.log(`✅ Removed from sync queue: ${id}`);
  }

  /**
   * Get all queue items
   */
  getQueue(): SyncQueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get queue stats
   */
  getQueueStats(): {
    total: number;
    pending: number;
    syncing: number;
    succeeded: number;
    failed: number;
  } {
    const items = this.getQueue();
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      syncing: items.filter(i => i.status === 'syncing').length,
      succeeded: items.filter(i => i.status === 'succeeded').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  }

  /**
   * Process all pending items in queue
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingItems = Array.from(this.queue.values()).filter(
        item => item.status === 'pending'
      );

      console.log(`🔄 Processing ${pendingItems.length} items from sync queue`);

      for (const item of pendingItems) {
        await this.processSingleItem(item);

        // Small delay between items to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clear succeeded items after processing
      const succeededCount = Array.from(this.queue.values()).filter(
        i => i.status === 'succeeded'
      ).length;

      if (succeededCount > 0) {
        console.log(`✅ ${succeededCount} items synced successfully`);
        this.clearSucceeded();
      }

      this.dispatchQueueChangeEvent();
    } catch (err) {
      console.error('❌ Error processing sync queue:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queue item
   */
  private async processSingleItem(item: SyncQueueItem): Promise<void> {
    if (item.status === 'syncing') {
      return; // Already processing
    }

    item.status = 'syncing';
    this.saveQueueToStorage();

    try {
      let result;

      switch (item.type) {
        case 'products':
          result = await syncProducts(item.userId, item.data);
          break;
        case 'deletedProducts':
          result = await syncDeletedProducts(item.userId, item.data);
          break;
        case 'cataloguesDefinition':
          result = await syncCataloguesDefinition(item.userId, item.data);
          break;
        case 'fieldsDefinition':
          result = await syncFieldsDefinition(item.userId, item.data);
          break;
        case 'userSettings':
          result = await syncUserSettings(item.userId, item.data);
          break;
        default:
          throw new Error(`Unknown sync type: ${item.type}`);
      }

      if (result.success) {
        item.status = 'succeeded';
        item.error = undefined;
        console.log(`✅ Synced ${item.type} from queue`);
      } else {
        item.status = 'failed';
        item.error = result.error;
        item.retries++;

        if (item.retries < item.maxRetries) {
          item.status = 'pending'; // Retry
          console.warn(
            `⚠️ Sync failed for ${item.type}, will retry (${item.retries}/${item.maxRetries})`
          );
        } else {
          console.error(`❌ Sync failed permanently for ${item.type}: ${result.error}`);
        }
      }
    } catch (err) {
      item.status = 'failed';
      item.error = err instanceof Error ? err.message : 'Unknown error';
      item.retries++;

      if (item.retries < item.maxRetries) {
        item.status = 'pending'; // Retry
      }

      console.error(`❌ Exception syncing ${item.type}:`, err);
    }

    this.saveQueueToStorage();
    this.dispatchQueueChangeEvent();
  }

  /**
   * Clear succeeded items from queue
   */
  private clearSucceeded(): void {
    Array.from(this.queue.entries()).forEach(([id, item]) => {
      if (item.status === 'succeeded') {
        this.queue.delete(id);
      }
    });
    this.saveQueueToStorage();
  }

  /**
   * Setup online/offline event listeners
   */
  private setupOnlineOfflineListeners(): void {
    window.addEventListener('online', () => {
      console.log('🟢 Online detected');
      this.isOnline = true;
      this.dispatchOnlineStatusEvent(true);
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('🔴 Offline detected');
      this.isOnline = false;
      this.dispatchOnlineStatusEvent(false);
    });
  }

  /**
   * Start retry interval for processing pending items
   */
  private startRetryInterval(): void {
    this.retryInterval = setInterval(() => {
      if (this.isOnline && !this.isProcessing) {
        const stats = this.getQueueStats();
        if (stats.pending > 0) {
          console.log(`🔄 Retrying ${stats.pending} pending items`);
          this.processQueue();
        }
      }
    }, this.RETRY_INTERVAL);
  }

  /**
   * Save queue to localStorage
   */
  private saveQueueToStorage(): void {
    try {
      const queueArray = Array.from(this.queue.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueArray));
    } catch (err) {
      console.warn('❌ Failed to save sync queue to storage:', err);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const items: SyncQueueItem[] = JSON.parse(stored);
        items.forEach(item => {
          this.queue.set(item.id, item);
        });
        console.log(`✅ Loaded ${items.length} items from sync queue storage`);
      }
    } catch (err) {
      console.warn('❌ Failed to load sync queue from storage:', err);
    }
  }

  /**
   * Dispatch queue change event
   */
  private dispatchQueueChangeEvent(): void {
    const stats = this.getQueueStats();
    window.dispatchEvent(
      new CustomEvent('sync-queue-change', {
        detail: {
          queue: this.getQueue(),
          stats,
          isOnline: this.isOnline,
        },
      })
    );
  }

  /**
   * Dispatch online status event
   */
  private dispatchOnlineStatusEvent(isOnline: boolean): void {
    window.dispatchEvent(
      new CustomEvent('sync-online-status', {
        detail: { isOnline },
      })
    );
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }
}

// Create singleton instance
export const syncQueue = new OfflineSyncQueue();

/**
 * Helper hook to use sync queue
 */
export function useSyncQueue() {
  return {
    addToQueue: (type: SyncQueueItemType, userId: string, data: any) =>
      syncQueue.addToQueue(type, userId, data),
    removeFromQueue: (id: string) => syncQueue.removeFromQueue(id),
    getQueue: () => syncQueue.getQueue(),
    getQueueStats: () => syncQueue.getQueueStats(),
    processQueue: () => syncQueue.processQueue(),
  };
}
