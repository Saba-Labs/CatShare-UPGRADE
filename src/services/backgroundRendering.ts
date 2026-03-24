import { BackgroundRendererWeb } from '../plugins/web';

import { safeGetFromStorage } from '../utils/safeStorage';

/** In-app worker renderer (same on web and native). Avoids Android native RenderingService, which mishandles https/file sources. */
function jsBackgroundRenderer(): BackgroundRendererWeb {
  return new BackgroundRendererWeb();
}

interface RenderProgressCallback {
  (progress: { percentage: number; currentItem?: string }): void;
}

interface RenderCompleteCallback {
  (result: { status: 'success' | 'error'; message: string }): void;
}

interface RenderErrorCallback {
  (error: { message: string }): void;
}

interface Product {
  id: string;
  name: string;
  imagePath?: string;
  image?: string;
  [key: string]: any;
}

interface Catalogue {
  id: string;
  label: string;
  priceField: string;
  priceUnitField?: string;
  stockField?: string;
}

let renderingProgress = 0;
let isRendering = false;
let currentRenderItems: Array<{
  id: string;
  name: string;
  imagePath?: string;
  renderConfig?: any;
}> = [];

// Track timer IDs for cleanup
let _progressInterval: NodeJS.Timeout | null = null;
let _completionTimeout: NodeJS.Timeout | null = null;

interface ResumableRenderState {
  items: Product[];
  catalogues: Catalogue[];
  startedAt: number;
}

let resumableState: ResumableRenderState | null = null;

/**
 * Optional batch rendering via a Web Worker inside the WebView (all platforms).
 * Does not use the native Android background service; primary user-driven renders are unchanged.
 * @param items Products to render
 * @param catalogues Catalogue configurations
 * @param onProgress Callback for progress updates
 * @param onComplete Callback for completion
 * @param onError Callback for errors
 */
export async function startBackgroundRendering(
  items: Product[],
  catalogues: Catalogue[],
  onProgress: RenderProgressCallback,
  onComplete: RenderCompleteCallback,
  onError: RenderErrorCallback
): Promise<void> {
  if (isRendering) {
    console.warn('⚠️ Rendering already in progress');
    return;
  }

  // Clear any existing timers before starting new ones
  if (_progressInterval) {
    clearInterval(_progressInterval);
    _progressInterval = null;
  }
  if (_completionTimeout) {
    clearTimeout(_completionTimeout);
    _completionTimeout = null;
  }

  isRendering = true;
  renderingProgress = 0;
  saveResumableState(items, catalogues);

  try {
    // Get watermark settings
    const isWatermarkEnabled = safeGetFromStorage('showWatermark', true);
    const watermarkText = safeGetFromStorage('watermarkText', 'Created using CatShare');
    const watermarkPosition = safeGetFromStorage('watermarkPosition', 'bottom-left');

    const { hydrateProductSourceForRender, pickRenderableImageForCanvas } = await import(
      '../utils/productSourceImage'
    );
    const { fetchUrlAsDataUrl } = await import('../utils/fetchImageCrossPlatform');

    const renderConfigCatalogues = catalogues.map((cat) => ({
      id: cat.id,
      label: cat.label,
      priceField: cat.priceField,
      priceUnitField: cat.priceUnitField,
      stockField: cat.stockField,
    }));

    const preparedItems: Array<{
      id: string;
      name: string;
      imagePath: string;
      renderConfig: { catalogues: typeof renderConfigCatalogues };
    }> = [];

    for (const product of items) {
      const p = { ...product };
      await hydrateProductSourceForRender(p);
      let src = pickRenderableImageForCanvas(p, null);
      if (src && /^https?:\/\//i.test(src)) {
        try {
          src = await fetchUrlAsDataUrl(src.trim());
        } catch (e) {
          console.warn('Background rendering: could not inline image URL, passing URL to worker:', e);
          src = pickRenderableImageForCanvas(p, null);
        }
      }
      preparedItems.push({
        id: p.id,
        name: p.name,
        imagePath: src || '',
        renderConfig: { catalogues: renderConfigCatalogues },
      });
    }

    const renderData = {
      items: preparedItems,
      format: 'png' as const,
      width: 1080,
      height: 1080,
      watermark: {
        enabled: isWatermarkEnabled,
        text: watermarkText,
        position: watermarkPosition,
      },
    };

    console.log('🌐 Starting optional background rendering via Web Worker');

    try {
      const result = await jsBackgroundRenderer().startRendering({
        renderData: renderData,
      });

      console.log('✅ Background rendering started:', result);

      const handleProgress = (event: any) => {
        const { percentage } = event.detail;
        renderingProgress = percentage;
        onProgress({
          percentage: percentage,
          currentItem: `Processing item ${Math.floor((percentage / 100) * items.length)} of ${items.length}`,
        });
      };

      const handleComplete = (event: any) => {
        window.removeEventListener('renderProgress', handleProgress);
        window.removeEventListener('renderComplete', handleComplete);

        if (_progressInterval) {
          clearInterval(_progressInterval);
          _progressInterval = null;
        }
        if (_completionTimeout) {
          clearTimeout(_completionTimeout);
          _completionTimeout = null;
        }

        isRendering = false;
        renderingProgress = 100;
        onComplete({
          status: 'success',
          message: `Successfully rendered ${items.length} items using Web Workers.`,
        });
      };

      window.addEventListener('renderProgress', handleProgress);
      window.addEventListener('renderComplete', handleComplete);

      _completionTimeout = setTimeout(() => {
        window.removeEventListener('renderProgress', handleProgress);
        window.removeEventListener('renderComplete', handleComplete);
        isRendering = false;
        renderingProgress = 100;
        onComplete({
          status: 'success',
          message: `Successfully rendered ${items.length} items.`,
        });
      }, 60000);
    } catch (error) {
      isRendering = false;
      console.error('❌ Failed to start background rendering:', error);
      throw error;
    }
  } catch (error) {
    isRendering = false;
    renderingProgress = 0;
    console.error('❌ Background rendering error:', error);
    onError({
      message: error instanceof Error ? error.message : 'Unknown rendering error',
    });
  }
}

/**
 * Cancel background rendering
 */
export async function cancelBackgroundRendering(): Promise<void> {
  try {
    isRendering = false;
    renderingProgress = 0;
    currentRenderItems = [];

    // Clear all pending timers
    if (_progressInterval) {
      clearInterval(_progressInterval);
      _progressInterval = null;
    }
    if (_completionTimeout) {
      clearTimeout(_completionTimeout);
      _completionTimeout = null;
    }

    console.log('📱 Cancelling background rendering...');

    const result = await jsBackgroundRenderer().stopRendering();
    console.log('✅ Background rendering cancelled:', result);
  } catch (error) {
    console.error('❌ Failed to cancel rendering:', error);
    throw error;
  }
}

/**
 * Get current rendering progress
 */
export function getRenderingProgress(): number {
  return renderingProgress;
}

/**
 * Check if rendering is currently active
 */
export function isRenderingActive(): boolean {
  return isRendering;
}

/**
 * Get rendering status from the in-app worker (not the native Android service).
 */
export async function getRenderingStatus(): Promise<{ isRunning: boolean }> {
  try {
    const status = await jsBackgroundRenderer().getStatus();
    return status;
  } catch (error) {
    console.error('❌ Failed to get rendering status:', error);
    return { isRunning: false };
  }
}

/**
 * Check if there's a resumable rendering state (from interrupted rendering)
 */
export function checkResumableRendering(): ResumableRenderState | null {
  if (resumableState) {
    const timeSinceStart = Date.now() - resumableState.startedAt;
    // Consider a render resumable if it was started less than 24 hours ago
    if (timeSinceStart < 24 * 60 * 60 * 1000) {
      return resumableState;
    } else {
      resumableState = null;
    }
  }
  return null;
}

/**
 * Resume background rendering from an interrupted state
 */
export async function resumeBackgroundRendering(
  items: Product[],
  catalogues: Catalogue[],
  onProgress: RenderProgressCallback,
  onComplete: RenderCompleteCallback,
  onError: RenderErrorCallback
): Promise<void> {
  console.log('🔄 Resuming background rendering...');
  resumableState = null; // Clear the resumable state

  // Simply delegate to startBackgroundRendering
  return startBackgroundRendering(items, catalogues, onProgress, onComplete, onError);
}

/**
 * Save rendering state for resumption if interrupted
 */
function saveResumableState(items: Product[], catalogues: Catalogue[]): void {
  resumableState = {
    items,
    catalogues,
    startedAt: Date.now(),
  };
  console.log('💾 Saved resumable rendering state');
}

export default {
  startBackgroundRendering,
  cancelBackgroundRendering,
  getRenderingProgress,
  isRenderingActive,
  getRenderingStatus,
  checkResumableRendering,
  resumeBackgroundRendering,
};
