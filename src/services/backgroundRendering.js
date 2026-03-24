import { saveRenderedImage } from "../Save";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { KeepAwake } from '@capacitor-community/keep-awake';

/**
 * Background Rendering Service
 * Handles PNG rendering in chunks to allow better app responsiveness
 * and graceful handling of backgrounding
 */

let renderingState = {
  isRendering: false,
  isCancelled: false,
  currentProductIndex: 0,
  totalProducts: 0,
  currentCatalogueIndex: 0,
  totalCatalogues: 0,
  renderStats: {
    successful: 0,
    failed: 0,
    failedProducts: []
  }
};

// Track app state for intelligent wakelock management
let appState = {
  isActive: true, // Assume active on startup
  appStateListener: null,
  wakelockRefreshInterval: null // For periodic wakelock refresh to prevent Doze
};

/**
 * Setup app state listener for intelligent wakelock management
 */
function setupAppStateListener() {
  if (!appState.appStateListener) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appState.isActive = isActive;
      console.log(`📱 App state changed: ${isActive ? 'FOREGROUND' : 'BACKGROUND'}`);

      const isNative = Capacitor.getPlatform() !== "web";

      // If app goes to foreground during rendering, resume aggressive refresh
      if (isActive && renderingState.isRendering) {
        if (isNative) {
          startWakelockRefresh(); // Resume aggressive refresh in foreground
          console.log("📱 App resumed - resuming aggressive wakelock refresh");
        }
      }
      // If app goes to background during rendering, switch to minimal refresh
      // Keep the device awake but reduce refresh frequency to save battery
      else if (!isActive && renderingState.isRendering) {
        if (isNative) {
          stopWakelockRefresh(); // Stop aggressive refresh
          startMinimalWakelockRefresh(); // Switch to minimal background refresh
          console.log("📱 App backgrounded - switched to minimal wakelock refresh for background rendering");
        }
      }
    }).then((listener) => {
      appState.appStateListener = listener;
    });
  }
}

/**
 * Start periodic wakelock refresh to prevent Doze mode (only when app is foreground)
 * Refreshes every 1 minute to keep the device in active state
 */
function startWakelockRefresh() {
  if (appState.wakelockRefreshInterval) {
    return; // Already running
  }

  const isNative = Capacitor.getPlatform() !== "web";
  if (!isNative) return;

  console.log("🔄 Starting aggressive wakelock refresh (1 min interval) to prevent Doze mode");

  appState.wakelockRefreshInterval = setInterval(async () => {
    if (renderingState.isRendering && appState.isActive) {
      try {
        // Release and immediately re-acquire to refresh the wakelock
        await KeepAwake.allowSleep();
        await KeepAwake.keepAwake();
        console.log("🔄 Wakelock refreshed to prevent Doze mode");
      } catch (err) {
        console.warn("⚠️ Could not refresh wakelock:", err);
      }
    }
  }, 60000); // Refresh every 60 seconds
}

/**
 * Stop periodic wakelock refresh
 */
function stopWakelockRefresh() {
  if (appState.wakelockRefreshInterval) {
    clearInterval(appState.wakelockRefreshInterval);
    appState.wakelockRefreshInterval = null;
    console.log("🛑 Stopped wakelock refresh interval");
  }
}

/**
 * Start minimal wakelock refresh for background rendering
 * Uses longer interval (5 min) to conserve battery while keeping device awake
 */
function startMinimalWakelockRefresh() {
  if (appState.wakelockRefreshInterval) {
    return; // Already running
  }

  const isNative = Capacitor.getPlatform() !== "web";
  if (!isNative) return;

  console.log("🔄 Starting minimal wakelock refresh (5 min interval) for background rendering");

  appState.wakelockRefreshInterval = setInterval(async () => {
    if (renderingState.isRendering && !appState.isActive) {
      try {
        // Light refresh - just ping the wakelock to keep it active
        await KeepAwake.keepAwake();
        console.log("🔄 Minimal wakelock refresh (background)");
      } catch (err) {
        console.warn("⚠️ Could not refresh wakelock in background:", err);
      }
    } else if (!renderingState.isRendering || appState.isActive) {
      // Stop if rendering finished or app came back to foreground
      stopWakelockRefresh();
    }
  }, 5 * 60 * 1000); // Refresh every 5 minutes
}

/**
 * Initialize background rendering with all products
 */
export async function startBackgroundRendering(products, catalogues, onProgress, onComplete, onError) {
  const isNative = Capacitor.getPlatform() !== "web";

  if (renderingState.isRendering) {
    console.warn("⚠️ Rendering already in progress");
    return;
  }

  renderingState.isRendering = true;
  renderingState.isCancelled = false;
  renderingState.currentProductIndex = 0;
  renderingState.totalProducts = products.length;
  renderingState.currentCatalogueIndex = 0;
  renderingState.totalCatalogues = catalogues.length;
  renderingState.renderStats = {
    successful: 0,
    failed: 0,
    failedProducts: []
  };

  try {
    // Setup app state listener
    setupAppStateListener();

    // Keep device awake during rendering, regardless of app state
    if (isNative) {
      try {
        await KeepAwake.keepAwake();
        console.log("✅ Device wakelock enabled for background rendering");

        // Choose refresh rate based on app state
        if (appState.isActive) {
          startWakelockRefresh(); // Aggressive refresh in foreground
          console.log("📱 App is active - using aggressive wakelock refresh");
        } else {
          startMinimalWakelockRefresh(); // Minimal refresh in background
          console.log("📱 App is backgrounded - using minimal wakelock refresh to conserve battery");
        }
      } catch (err) {
        console.warn("⚠️ Could not enable wakelock:", err);
      }
    }

    // Save initial state to localStorage for recovery if app crashes
    localStorage.setItem('renderingState', JSON.stringify(renderingState));

    // Process products in chunks to allow UI updates and backgrounding
    for (let i = 0; i < products.length; i++) {
      if (renderingState.isCancelled) {
        console.log("🛑 Rendering cancelled by user");
        break;
      }

      const product = products[i];
      renderingState.currentProductIndex = i;

      // Skip products without images
      if (!product.image && !product.imagePath && !product.imageUrl) {
        console.warn(`⚠️ Skipping ${product.name} - no image available`);
        updateProgress(onProgress);
        continue;
      }

      try {
        // Render for each catalogue
        for (let j = 0; j < catalogues.length; j++) {
          if (renderingState.isCancelled) break;

          const cat = catalogues[j];
          renderingState.currentCatalogueIndex = j;

          try {
            const legacyType = cat.id === "cat1" ? "wholesale" : cat.id === "cat2" ? "resell" : cat.id;

            await saveRenderedImage(product, legacyType, {
              resellUnit: product.resellUnit || "/ piece",
              wholesaleUnit: product.wholesaleUnit || "/ piece",
              packageUnit: product.packageUnit || "pcs / set",
              ageGroupUnit: product.ageUnit || "months",
              catalogueId: cat.id,
              catalogueLabel: cat.label,
              folder: cat.folder || cat.label,
              priceField: cat.priceField,
              priceUnitField: cat.priceUnitField,
            });

            renderingState.renderStats.successful++;
            console.log(`✅ Rendered: ${product.name} - ${cat.label}`);

          } catch (catalogueError) {
            console.error(`❌ Failed to render ${product.name} for ${cat.label}:`, catalogueError);
            renderingState.renderStats.failed++;
            if (!renderingState.renderStats.failedProducts.includes(product.name)) {
              renderingState.renderStats.failedProducts.push(product.name);
            }
          }

          updateProgress(onProgress);
        }

        // Small delay between products to allow memory cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (productError) {
        console.error(`❌ Error processing ${product.name}:`, productError);
        renderingState.renderStats.failed++;
        if (!renderingState.renderStats.failedProducts.includes(product.name)) {
          renderingState.renderStats.failedProducts.push(product.name);
        }
      }

      updateProgress(onProgress);
    }

    // Rendering complete
    renderingState.isRendering = false;
    localStorage.removeItem('renderingState');

    // Release wakelock (if app was active - otherwise already released when backgrounded)
    stopWakelockRefresh(); // Stop aggressive refresh

    if (isNative) {
      try {
        await KeepAwake.allowSleep();
        console.log("✅ Device wakelock released");
      } catch (err) {
        console.warn("⚠️ Could not release wakelock:", err);
      }
    }

    // Clear app state listener cleanup
    renderingState.isRendering = false;

    // Build result message
    const totalProcessed = renderingState.renderStats.successful + renderingState.renderStats.failed;
    const resultMessage = buildResultMessage(renderingState.renderStats, totalProcessed);

    console.log("✅ Background rendering completed:", resultMessage);

    // Show notification
    if (isNative) {
      await sendBackgroundRenderingNotification(resultMessage, renderingState.renderStats.failed === 0);
    }

    // Call completion callback
    if (onComplete) {
      onComplete({
        status: renderingState.renderStats.failed === 0 ? "success" : "partial",
        message: resultMessage,
        stats: renderingState.renderStats
      });
    }

  } catch (error) {
    console.error("❌ Background rendering failed:", error);
    renderingState.isRendering = false;
    localStorage.removeItem('renderingState');

    // Release wakelock on error
    stopWakelockRefresh(); // Stop aggressive refresh

    if (isNative) {
      try {
        await KeepAwake.allowSleep();
      } catch (err) {
        console.warn("⚠️ Could not release wakelock on error:", err);
      }
    }

    if (onError) {
      onError(error);
    }
  }
}

/**
 * Cancel ongoing rendering
 */
export async function cancelBackgroundRendering() {
  console.log("⏹️ Cancelling background rendering...");
  renderingState.isCancelled = true;
  renderingState.isRendering = false;
  localStorage.removeItem('renderingState');

  // Cleanup wakelock
  stopWakelockRefresh();

  const isNative = Capacitor.getPlatform() !== "web";
  if (isNative) {
    try {
      await KeepAwake.allowSleep();
      console.log("✅ Wakelock released after cancellation");
    } catch (err) {
      console.warn("⚠️ Could not release wakelock:", err);
    }
  }
}

/**
 * Get current rendering progress
 */
export function getRenderingProgress() {
  if (!renderingState.isRendering) return null;

  const totalItems = renderingState.totalProducts * renderingState.totalCatalogues;
  const completedItems = renderingState.currentProductIndex * renderingState.totalCatalogues + renderingState.currentCatalogueIndex;
  const percentage = Math.round((completedItems / totalItems) * 100);

  return {
    isRendering: true,
    percentage,
    current: completedItems,
    total: totalItems,
    currentProduct: renderingState.currentProductIndex + 1,
    totalProducts: renderingState.totalProducts,
    stats: renderingState.renderStats
  };
}

/**
 * Check if rendering was in progress before app crash/close
 */
export function checkResumableRendering() {
  const state = localStorage.getItem('renderingState');
  if (state) {
    try {
      return JSON.parse(state);
    } catch (err) {
      console.warn("⚠️ Could not parse rendering state:", err);
      localStorage.removeItem('renderingState');
    }
  }
  return null;
}

/**
 * Resume rendering from where it left off
 */
export async function resumeBackgroundRendering(products, catalogues, onProgress, onComplete, onError) {
  const resumableState = checkResumableRendering();
  if (!resumableState) {
    console.log("No resumable rendering state found");
    return false;
  }

  console.log("📋 Resuming previous rendering session...", resumableState);
  
  // Start from where we left off
  renderingState = resumableState;
  renderingState.isRendering = true;
  renderingState.isCancelled = false;

  // Filter to products not yet fully processed
  const remainingProducts = products.slice(resumableState.currentProductIndex);

  try {
    await startBackgroundRendering(remainingProducts, catalogues, onProgress, onComplete, onError);
    return true;
  } catch (error) {
    console.error("❌ Failed to resume rendering:", error);
    return false;
  }
}

/**
 * Update progress and save state
 */
function updateProgress(onProgress) {
  const progress = getRenderingProgress();
  localStorage.setItem('renderingState', JSON.stringify(renderingState));
  
  if (onProgress) {
    onProgress(progress);
  }
}

/**
 * Build user-friendly result message
 */
function buildResultMessage(stats, totalProcessed) {
  const { successful, failed, failedProducts } = stats;

  if (failed === 0) {
    return `✅ All ${successful} images rendered successfully!`;
  } else if (successful === 0) {
    return `❌ Rendering failed for all products`;
  } else {
    return `⚠️ Rendered ${successful}/${totalProcessed} images. ${failed} failed: ${failedProducts.join(", ")}`;
  }
}

/**
 * Send notification about background rendering completion
 * High priority with sound and vibration to ensure user sees it
 */
async function sendBackgroundRenderingNotification(message, isSuccess) {
  const isNative = Capacitor.getPlatform() !== "web";
  if (!isNative) return;

  try {
    // Create high-priority channel for rendering notifications
    await LocalNotifications.createChannel({
      id: 'background_render_channel',
      name: 'Background Rendering',
      description: 'Notifications for image rendering completion',
      importance: 5, // IMPORTANCE_MAX = 5 on Android
      visibility: 1, // VISIBILITY_PUBLIC = 1
      sound: 'default',
      enableVibration: true,
      enableLights: true,
      lightColor: isSuccess ? '#4CAF50' : '#FF9800', // Green for success, Orange for errors
    });

    // Schedule notification with high priority and vibration
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000) + 1,
          title: isSuccess ? "✅ Rendering Complete" : "⚠️ Rendering Completed with Errors",
          body: message,
          channelId: 'background_render_channel',
          smallIcon: isSuccess ? "res://drawable/ic_stat_notify_success" : "res://drawable/ic_stat_notify_error",
          largeBody: message, // Extended notification text
          summaryText: isSuccess ? 'All images rendered successfully' : 'Some images failed to render',
          autoCancel: true,
          ongoing: false, // Allows user to dismiss
          priority: isSuccess ? 2 : 2, // HIGH priority on Android (shows at top of notification list)
        },
      ]
    });

    console.log("✅ High-priority background rendering notification sent with sound & vibration");
  } catch (error) {
    console.error("❌ Failed to send notification:", error);
  }
}
