import { getAnalytics, logEvent } from "firebase/analytics";
import { analytics } from "./firebaseConfig";

// Event name constants - prevents typos and centralizes event naming
export const ANALYTICS_EVENTS = {
  // Product Management
  PRODUCT_ADDED: "product_created",
  PRODUCT_EDITED: "product_edited",
  PRODUCT_DELETED: "product_deleted",
  BULK_EDIT: "bulk_edit",
  BULK_IMPORT_IMAGES: "bulk_import_images",

  // Image Rendering
  RENDER_STARTED: "render_started",
  RENDER_COMPLETED: "render_completed",
  RENDER_SINGLE_PRODUCT: "render_single_product",
  RENDER_ALL_PRODUCTS: "render_all_products",

  // Sharing & Exporting
  BACKUP_CREATED: "backup_created",
  BACKUP_RESTORED: "backup_restored",
  BACKUP_SHARED_FILESHARER: "backup_shared_filesharer",
  BACKUP_DOWNLOADED: "backup_downloaded",
  CSV_EXPORTED: "csv_exported",
  SHARE_INITIATED: "share_initiated",
  SHARE_COMPLETED: "share_completed",

  // UI/Settings Changes
  THEME_CHANGED: "theme_changed",
  WATERMARK_APPLIED: "watermark_applied",
  CATALOGUE_CREATED: "catalogue_created",
  CATALOGUE_DELETED: "catalogue_deleted",
  CATEGORY_MANAGED: "category_managed",

  // Mobile-Specific
  FILESHARER_ERROR: "filesharer_error",
  OFFLINE_USAGE: "offline_usage",
} as const;

// Type definitions for event parameters
export interface EventParameters {
  [key: string]: string | number | boolean;
}

// Wrapper function to log events to both web and mobile platforms
export const logAnalyticsEvent = (
  eventName: string,
  parameters?: EventParameters
) => {
  try {
    // Log to Firebase Analytics (JS SDK for web)
    if (analytics) {
      logEvent(analytics, eventName, parameters);
    }
  } catch (error) {
    console.error(`Error logging analytics event "${eventName}":`, error);
  }

  // Also try to log to Capacitor Firebase Analytics if available (mobile)
  if (window.FirebaseAnalytics) {
    try {
      window.FirebaseAnalytics.logEvent({
        name: eventName,
        parameters: parameters || {},
      });
    } catch (error) {
      console.error(
        `Error logging event to Capacitor "${eventName}":`,
        error
      );
    }
  }
};

// Specific event logging functions with proper parameter types

export const logProductAdded = (productCount?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.PRODUCT_ADDED, {
    timestamp: Date.now(),
    ...(productCount && { product_count: productCount }),
  });
};

export const logProductEdited = (productId?: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.PRODUCT_EDITED, {
    timestamp: Date.now(),
    ...(productId && { product_id: productId }),
  });
};

export const logProductDeleted = (productId?: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.PRODUCT_DELETED, {
    timestamp: Date.now(),
    ...(productId && { product_id: productId }),
  });
};

export const logBulkEdit = (productCount?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.BULK_EDIT, {
    timestamp: Date.now(),
    ...(productCount && { product_count: productCount }),
  });
};

export const logBulkImportImages = (count: number, framing?: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.BULK_IMPORT_IMAGES, {
    timestamp: Date.now(),
    count,
    ...(framing && { framing }),
  });
};

export const logRenderStarted = (renderType: "single" | "all") => {
  logAnalyticsEvent(ANALYTICS_EVENTS.RENDER_STARTED, {
    timestamp: Date.now(),
    render_type: renderType,
  });
};

export const logRenderCompleted = (
  renderType: "single" | "all",
  success: boolean,
  duration?: number
) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.RENDER_COMPLETED, {
    timestamp: Date.now(),
    render_type: renderType,
    success,
    ...(duration && { duration_ms: duration }),
  });
};

export const logRenderSingleProduct = () => {
  logAnalyticsEvent(ANALYTICS_EVENTS.RENDER_SINGLE_PRODUCT, {
    timestamp: Date.now(),
  });
};

export const logRenderAllProducts = () => {
  logAnalyticsEvent(ANALYTICS_EVENTS.RENDER_ALL_PRODUCTS, {
    timestamp: Date.now(),
  });
};

export const logBackupCreated = (fileSize?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.BACKUP_CREATED, {
    timestamp: Date.now(),
    ...(fileSize && { file_size_bytes: fileSize }),
  });
};

export const logBackupRestored = (fileSize?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.BACKUP_RESTORED, {
    timestamp: Date.now(),
    ...(fileSize && { file_size_bytes: fileSize }),
  });
};

export const logBackupSharedFileSharer = (fileSize?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.BACKUP_SHARED_FILESHARER, {
    timestamp: Date.now(),
    ...(fileSize && { file_size_bytes: fileSize }),
  });
};

export const logBackupDownloaded = (fileSize?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.BACKUP_DOWNLOADED, {
    timestamp: Date.now(),
    ...(fileSize && { file_size_bytes: fileSize }),
  });
};

export const logCsvExported = (productCount?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.CSV_EXPORTED, {
    timestamp: Date.now(),
    ...(productCount && { product_count: productCount }),
  });
};

export const logShareInitiated = (shareMethod: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.SHARE_INITIATED, {
    timestamp: Date.now(),
    share_method: shareMethod,
  });
};

export const logShareCompleted = (
  shareMethod: string,
  success: boolean,
  duration?: number
) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.SHARE_COMPLETED, {
    timestamp: Date.now(),
    share_method: shareMethod,
    success,
    ...(duration && { duration_ms: duration }),
  });
};

export const logThemeChanged = (themeName: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.THEME_CHANGED, {
    timestamp: Date.now(),
    theme_name: themeName,
  });
};

export const logWatermarkApplied = (watermarkType?: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.WATERMARK_APPLIED, {
    timestamp: Date.now(),
    ...(watermarkType && { watermark_type: watermarkType }),
  });
};

export const logCatalogueCreated = (catalogueName?: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.CATALOGUE_CREATED, {
    timestamp: Date.now(),
    ...(catalogueName && { catalogue_name: catalogueName }),
  });
};

export const logCatalogueDeleted = (catalogueId?: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.CATALOGUE_DELETED, {
    timestamp: Date.now(),
    ...(catalogueId && { catalogue_id: catalogueId }),
  });
};

export const logCategoryManaged = (
  action: "added" | "edited" | "deleted",
  categoryName?: string
) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.CATEGORY_MANAGED, {
    timestamp: Date.now(),
    action,
    ...(categoryName && { category_name: categoryName }),
  });
};

export const logFileSharerError = (errorType: string) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.FILESHARER_ERROR, {
    timestamp: Date.now(),
    error_type: errorType,
  });
};

export const logOfflineUsage = (duration?: number) => {
  logAnalyticsEvent(ANALYTICS_EVENTS.OFFLINE_USAGE, {
    timestamp: Date.now(),
    ...(duration && { duration_ms: duration }),
  });
};

// Declare window interface for Capacitor Firebase Analytics
declare global {
  interface Window {
    FirebaseAnalytics?: {
      logEvent: (options: { name: string; parameters: EventParameters }) => void;
    };
  }
}
