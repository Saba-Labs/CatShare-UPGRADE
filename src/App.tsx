import React, { useEffect, useState, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import { KeepAwake } from '@capacitor-community/keep-awake';
import { initializeFieldSystem } from "./config/initializeFields";
import { getFieldsDefinition, setFieldsDefinition } from "./config/fieldConfig";
import { runMigrations } from "./utils/dataMigration";
import { LocalNotifications } from '@capacitor/local-notifications';
import { initializeFirebaseMessaging } from "./services/firebaseService";
import { safeGetFromStorage, safeSetInStorage } from "./utils/safeStorage";
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { useAuth } from "./context/AuthContext";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";

import CatalogueApp from "./CatalogueApp";
import CreateProduct from "./CreateProduct";
import Shelf from "./Shelf";
import Retail from "./Retail";
import Settings from "./Settings";
import AppearanceSettings from "./pages/AppearanceSettings";
import ThemesSettings from "./pages/ThemesSettings";
import WatermarkSettings from "./pages/WatermarkSettings";
import FieldsSettings from "./pages/FieldsSettings";
import CurrencySettings from "./pages/CurrencySettings";
import ProInfo from "./pages/ProInfo";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Account from "./pages/Account";
import OrderForm from "./pages/OrderForm";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfService from "./TermsOfService";
import Website from "./Website";
import Tutorial from "./Tutorial";
import { ToastProvider } from "./context/ToastContext";
import { ToastContainer } from "./components/ToastContainer";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import RenderingOverlay from "./RenderingOverlay";
import ErrorBoundary from "./components/ErrorBoundary";
import { saveRenderedImage } from "./Save";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { getAllCatalogues } from "./config/catalogueConfig";
import { ThemeProvider } from "./context/ThemeContext";

function AppWithBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, supabaseData, supabaseDataLoading } = useAuth();
  const [imageMap, setImageMap] = useState({});
  const [products, setProducts] = useState(() =>
    safeGetFromStorage("products", [])
  );
  const [deletedProducts, setDeletedProducts] = useState(() =>
    safeGetFromStorage("deletedProducts", [])
  );
  const [darkMode, setDarkMode] = useState(() => {
    return safeGetFromStorage("darkMode", false);
  });
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderingTotal, setRenderingTotal] = useState(0);
  const [renderResult, setRenderResult] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const renderResultTimeoutRef = useRef(null);
  const previousUserIdRef = useRef<string | null>(null);
  const [showFirstSyncBanner, setShowFirstSyncBanner] = useState(false);

  const isNative = Capacitor.getPlatform() !== "web";

  // Reset local product data when the authenticated user changes
  useEffect(() => {
    const currentUserId = user?.uid || null;
    const previous = previousUserIdRef.current;

    // Only clear when switching between two different logged-in users.
    // Do NOT clear when going from "no user" -> first login, so existing
    // offline data can be synced into the account.
    if (previous && currentUserId && currentUserId !== previous) {
      // Clear in-memory and local storage products for new user
      setProducts([]);
      setDeletedProducts([]);
      safeSetInStorage("products", []);
      safeSetInStorage("deletedProducts", []);
      console.log('🔄 Cleared local products for user change:', currentUserId);
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.uid]);

  // Merge Supabase data with local storage when user logs in
  useEffect(() => {
    if (!user || !supabaseData || supabaseDataLoading) return;

    try {
      setSupabaseSyncStatus('syncing');

      // Merge products: Supabase data takes precedence if it's newer
      if (supabaseData.products && supabaseData.products.length > 0) {
        // ✅ Build set of shelved product IDs so they never come back from Supabase
        const currentDeletedIds = new Set([
          ...deletedProducts.map((p: any) => p.id),
          ...(supabaseData.deletedProducts || []).map((p: any) => p.id),
        ]);
        const merged = mergeProductsData(products, supabaseData.products, currentDeletedIds);
        setProducts(merged);
        safeSetInStorage("products", merged);
        console.log('✅ Merged products from Supabase');
      }

      // Merge deleted products
      if (supabaseData.deletedProducts && supabaseData.deletedProducts.length > 0) {
        const merged = mergeProductsData(deletedProducts, supabaseData.deletedProducts);
        setDeletedProducts(merged);
        safeSetInStorage("deletedProducts", merged);
        console.log('✅ Merged deleted products from Supabase');
      }

      // Apply remote fieldsDefinition from Supabase to local storage
      if (supabaseData.fieldsDefinition && Array.isArray(supabaseData.fieldsDefinition?.fields)) {
        const localFieldsDef = getFieldsDefinition();
        const remoteFieldsDef = supabaseData.fieldsDefinition;

        // Check if remote is newer or local doesn't have a valid definition
        const localLastUpdated = localFieldsDef?.lastUpdated ? new Date(localFieldsDef.lastUpdated).getTime() : 0;
        const remoteLastUpdated = remoteFieldsDef?.lastUpdated ? new Date(remoteFieldsDef.lastUpdated).getTime() : 0;

        if (remoteLastUpdated > localLastUpdated) {
          setFieldsDefinition(remoteFieldsDef);
          console.log('✅ Applied remote fieldsDefinition from Supabase:', remoteFieldsDef.industry || 'Custom');

          // Dispatch event so components (like FieldsSettings) refresh their UI
          window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
            detail: {
              newDefinition: remoteFieldsDef,
              template: remoteFieldsDef?.industry || 'Custom',
              isBackupRestore: false
            }
          }));
        }
      }

      setSupabaseSyncStatus('synced');
    } catch (err) {
      console.error('❌ Error merging Supabase data:', err);
      setSupabaseSyncStatus('error');
    }
  }, [user, supabaseData, supabaseDataLoading]);

  // Show a one-time banner when we detect existing offline products
  // being synced to the logged-in account on this device.
  useEffect(() => {
    if (!user || supabaseDataLoading) return;

    const userId = user.uid;
    const key = `cloudSyncDone::${userId}`;
    const already = localStorage.getItem(key) === 'true';

    const localProducts = safeGetFromStorage("products", []);
    const hasLocalProducts = Array.isArray(localProducts) && localProducts.length > 0;

    if (!already && hasLocalProducts) {
      setShowFirstSyncBanner(true);
    }
  }, [user, supabaseDataLoading]);

  // When initial sync finishes, mark done and optionally auto-hide banner.
  useEffect(() => {
    if (!user) return;
    if (supabaseSyncStatus !== 'synced') return;
    if (!showFirstSyncBanner) return;

    const userId = user.uid;
    const key = `cloudSyncDone::${userId}`;
    localStorage.setItem(key, 'true');

    const timeout = setTimeout(() => {
      setShowFirstSyncBanner(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [user, supabaseSyncStatus, showFirstSyncBanner]);

  // Merge products by keeping the newer version (based on timestamp)
  const mergeProductsData = (local: any[], remote: any[], deletedIds: Set<string> = new Set()) => {
    const merged = new Map();
  
    local.forEach(product => {
      merged.set(product.id, product);
    });
  
    remote.forEach(remoteProduct => {
      // ✅ Never bring back shelved/deleted products
      if (deletedIds.has(remoteProduct.id)) return;
  
      const localProduct = merged.get(remoteProduct.id);
      if (!localProduct) {
        merged.set(remoteProduct.id, remoteProduct);
      } else {
        const localTime = new Date(localProduct.updatedAt || 0).getTime();
        const remoteTime = new Date(remoteProduct.updatedAt || 0).getTime();
        if (remoteTime > localTime) {
          merged.set(remoteProduct.id, remoteProduct);
        }
      }
    });
  
    return Array.from(merged.values());
  };

  // Handle rendering images with chunked processing to prevent UI freeze
  // Processes in small batches with UI yielding between chunks
  const handleRenderPNGs = useCallback(async (customProducts?: any[], showOverlay: boolean = true) => {
    const all = customProducts || safeGetFromStorage("products", []);
    if (all.length === 0) return;

    // Prevent screen from sleeping during rendering
    try {
      if (isNative) {
        await KeepAwake.keepAwake();
        console.log("🔓 Screen wakelock acquired for rendering");
      }
    } catch (e) {
      console.warn("Could not acquire keep awake lock:", e);
    }

    // Force synchronous state updates so overlay renders with correct total
    if (showOverlay) {
      flushSync(() => setIsRendering(true));
    }
    flushSync(() => {
      setRenderProgress(0);
      setRenderingTotal(all.length);
    });

    // Get all catalogues
    const catalogues = getAllCatalogues();
    let renderedCount = 0;

    // Chunk size - process this many products before yielding to UI thread
    // Smaller chunk = more responsive UI but slower overall
    // Larger chunk = less responsive but faster overall
    // 2-3 is optimal for Capacitor apps to avoid freezing
    const CHUNK_SIZE = 2;

    // Helper function to yield to UI thread
    const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

    try {
      // Process products in chunks
      for (let chunkStart = 0; chunkStart < all.length; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, all.length);

        // Process all products in this chunk
        const chunkPromises = [];
        for (let i = chunkStart; i < chunkEnd; i++) {
          const product = all[i];

          // Skip products without images
          if (!product.image && !product.imagePath && !product.imageUrl) {
            console.warn(`⚠️ Skipping ${product.name} - no image available`);
            flushSync(() => setRenderProgress(i + 1));
            window.dispatchEvent(new CustomEvent("renderProgress", {
              detail: {
                percentage: Math.round(((i + 1) / all.length) * 100),
                current: i + 1,
                total: all.length
              }
            }));
            continue;
          }

          // Create promise for this product's rendering
          const renderProductPromise = (async () => {
            try {
              // Render for all catalogues
              for (const cat of catalogues) {
                // For backward compatibility, map cat1->wholesale and cat2->resell
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

                renderedCount++;
              }

              console.log(`✅ Rendered images for ${product.name} (${catalogues.length} catalogues)`);

              // Update progress after product completes
              const productIndex = Math.floor(renderedCount / catalogues.length);
              const percentage = Math.round((productIndex / all.length) * 100);

              flushSync(() => setRenderProgress(productIndex));
              window.dispatchEvent(new CustomEvent("renderProgress", {
                detail: {
                  percentage: percentage,
                  current: productIndex,
                  total: all.length
                }
              }));
            } catch (err) {
              console.warn(`❌ Failed to render images for ${product.name}:`, err);
            }
          })();

          chunkPromises.push(renderProductPromise);
        }

        // Wait for all products in this chunk to complete
        await Promise.all(chunkPromises);

        // Yield to UI thread between chunks to keep app responsive
        // This prevents the app from freezing during rendering
        await yieldToUI();
      }

      if (showOverlay) {
        setIsRendering(false);
        setRenderResult({
          status: "success",
          message: `Image rendering completed for ${all.length} products and ${catalogues.length} catalogues`,
        });
      }
      console.log(`✅ Rendering complete`);
      // Set progress to 100% at the end
      setRenderProgress(all.length);
      window.dispatchEvent(new CustomEvent("renderComplete"));
    } catch (err) {
      console.error("❌ Rendering failed:", err);
      if (showOverlay) {
        setIsRendering(false);
        setRenderResult({
          status: "error",
          message: `Rendering error: ${err.message}`,
        });
      }
      window.dispatchEvent(new CustomEvent("renderComplete"));
    } finally {
      // Re-enable screen sleeping after rendering is done
      try {
        if (isNative) {
          await KeepAwake.allowSleep();
          console.log("🔒 Screen wakelock released after rendering");
        }
      } catch (e) {
        console.warn("Could not release keep awake lock:", e);
      }
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;
    const applyFullscreen = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.hide();
      } catch (e) {
        console.warn("StatusBar hide failed:", e);
      }
    };

    // run once
    applyFullscreen();

    // re-apply on app resume
    let removeResume: any;
    CapacitorApp.addListener("resume", applyFullscreen).then((listener) => {
      removeResume = listener.remove;
    });

    // re-apply when page becomes visible
    const onVis = () => {
      if (!document.hidden) applyFullscreen();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (removeResume) removeResume();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isNative]);

  useEffect(() => {
    const cleanedProducts = products.map(p => {
      const clean = { ...p };
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
      // ✅ Always stamp updatedAt so Supabase merge knows which version is newer
      if (!clean.updatedAt) {
        clean.updatedAt = new Date().toISOString();
      }
      return clean;
    });
    safeSetInStorage("products", cleanedProducts);
  }, [products]);

  // Sync products to Supabase whenever they change
  useEffect(() => {
    if (!user) return;

    const userId = user.uid;
    if (!userId || products.length === 0) return;

    // Import and call syncProducts in background (fire and forget)
    import('./services/supabaseSync').then(({ syncProducts }) => {
      syncProducts(userId, products).then(result => {
        if (result.success) {
          console.log('✅ Products synced to Supabase');
        } else {
          console.warn('⚠️ Supabase sync failed:', result.error);
        }
      });
    });
  }, [products, user]);

  useEffect(() => {
    // Strip image data from deleted products too
    const cleanedDeleted = deletedProducts.map(p => {
      const clean = { ...p };
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
      return clean;
    });
    safeSetInStorage("deletedProducts", cleanedDeleted);
  }, [deletedProducts]);

  // ✅ Sync deleted products to Supabase whenever they change
  useEffect(() => {
    if (!user) return;

    const userId = user.uid;
    if (!userId) return;

    // Only sync if there are deleted products
    if (deletedProducts.length === 0) return;

    // Import and call syncDeletedProducts in background (fire and forget)
    import('./services/supabaseSync').then(({ syncDeletedProducts }) => {
      syncDeletedProducts(userId, deletedProducts).then(result => {
        if (result.success) {
          console.log(`✅ ${deletedProducts.length} deleted products synced to Supabase`);
        } else {
          console.warn('⚠️ Deleted products sync failed:', result.error);
        }
      });
    });
  }, [deletedProducts, user]);

  useEffect(() => {
    safeSetInStorage("darkMode", darkMode);
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Initialize field system with data migration on first load
  useEffect(() => {
    initializeFieldSystem();
  }, []);

  // Initialize Firebase messaging for notifications
  useEffect(() => {
    const setupFirebase = async () => {
      // Ensure user has a unique ID
      if (!localStorage.getItem("userId")) {
        localStorage.setItem("userId", `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      }

      // Initialize Capacitor Firebase Analytics for mobile
      if (isNative) {
        try {
          await FirebaseAnalytics.setEnabled({ enabled: true });
          await FirebaseAnalytics.logEvent({ name: 'app_open' });

          // Expose FirebaseAnalytics to window for use by analyticsEvents.ts
          (window as any).FirebaseAnalytics = {
            logEvent: async (options: { name: string; parameters: Record<string, any> }) => {
              try {
                await FirebaseAnalytics.logEvent(options);
              } catch (error) {
                console.error('Error logging event to Capacitor:', error);
              }
            }
          };

          console.log('✅ Firebase Analytics initialized on mobile');
        } catch (error) {
          console.warn('⚠️ Firebase Analytics error on mobile:', error);
        }
      }

      await initializeFirebaseMessaging();
    };
    setupFirebase();

    // Listen for Firebase notifications
    const handleFirebaseNotification = (event: any) => {
      console.log("Firebase notification received in app:", event.detail);
      setRenderResult({
        status: "success",
        message: event.detail.body || "Rendering completed successfully!",
      });
      setRenderProgress(100);
    };

    window.addEventListener("firebaseNotification", handleFirebaseNotification);
    return () => {
      window.removeEventListener("firebaseNotification", handleFirebaseNotification);
    };
  }, []);

  // Initialize catalogue system with data migration
  useEffect(() => {
    const runAsyncMigrations = async () => {
      try {
        await runMigrations();
      } catch (err) {
        console.error("❌ Migrations failed:", err);
      }
    };
    runAsyncMigrations();
  }, []);

  // Check if user needs to complete onboarding
  useEffect(() => {
    const hasCompletedOnboarding = safeGetFromStorage('hasCompletedOnboarding', false);

    // Only redirect to welcome if not already on welcome, order form, or other public pages
    if (!hasCompletedOnboarding &&
        !location.pathname.includes('/welcome') &&
        !location.pathname.includes('/privacy') &&
        !location.pathname.includes('/terms') &&
        !location.pathname.includes('/website') &&
        !location.pathname.includes('/o/')) {
      navigate('/welcome');
    }
  }, [navigate, location.pathname]);

  // Initialize watermark settings with defaults on first load
  useEffect(() => {
    const showWatermark = localStorage.getItem("showWatermark");
    const watermarkText = localStorage.getItem("watermarkText");
    const watermarkPosition = localStorage.getItem("watermarkPosition");

    if (showWatermark === null) {
      safeSetInStorage("showWatermark", true); // Default: enabled
    }
    if (watermarkText === null) {
      safeSetInStorage("watermarkText", "Created using CatShare");
    }
    if (watermarkPosition === null) {
      safeSetInStorage("watermarkPosition", "bottom-left");
    }
  }, []);

  useEffect(() => {
    const handleNewProduct = () =>
      setProducts(JSON.parse(localStorage.getItem("products") || "[]"));
    window.addEventListener("product-added", handleNewProduct);
    return () =>
      window.removeEventListener("product-added", handleNewProduct);
  }, []);

  useEffect(() => {
    let removeListener: any;

    // Handle back button press
    // Note: This listener may be overridden by child components (like CatalogueApp)
    // when they need to handle back navigation within their own context.
    // For home page (/) routes, CatalogueApp handles back navigation and dispatches
    // "catalogue-app-back-not-handled" event when it can't handle it.
    const handleBackPress = () => {
      if (isRendering) {
        CapacitorApp.minimizeApp();
        return;
      }

      // Check for any open modals from SideDrawer or CatalogueApp
      const sideDrawerState = (window as any).__sideDrawerState;
      const catalogueAppState = (window as any).__catalogueAppState;

      // Check SideDrawer modals first
      if (sideDrawerState?.showBackupPopup) {
        sideDrawerState.setShowBackupPopup(false);
        return;
      }
      if (sideDrawerState?.showRenderAfterRestore) {
        sideDrawerState.setShowRenderAfterRestore(false);
        return;
      }
      if (sideDrawerState?.showCategories) {
        sideDrawerState.setShowCategories(false);
        return;
      }
      if (sideDrawerState?.showBulkEdit) {
        sideDrawerState.setShowBulkEdit(false);
        return;
      }
      if (sideDrawerState?.showMediaLibrary) {
        sideDrawerState.setShowMediaLibrary(false);
        return;
      }

      // Check global tutorial modal
      if (showTutorial) {
        setShowTutorial(false);
        return;
      }

      const fullScreenImageOpen = document.querySelector('[data-fullscreen-image="true"]');
      // Check for product preview modal backdrop (backdrop-blur-xl with z-50)
      const previewModalOpen = document.querySelector(".backdrop-blur-xl.z-50");
      if (fullScreenImageOpen || previewModalOpen) {
        window.dispatchEvent(new CustomEvent("close-preview"));
      } else if (location.pathname !== "/") {
        navigate(-1);
      } else {
        // Do nothing here for the root path.
        // The CatalogueApp has its own backButton listener and will dispatch
        // "catalogue-app-back-not-handled" if it's on the main screen and wants to exit.
        console.log("Back button pressed on root path - letting CatalogueApp handle it");
      }
    };

    // Listen for fallback event from CatalogueApp when back is pressed on products tab
    // and no internal navigation is possible
    const handleCatalogueAppBackFallback = () => {
      CapacitorApp.exitApp();
    };

    CapacitorApp.addListener("backButton", handleBackPress).then((listener) => {
      removeListener = listener.remove;
    });

    window.addEventListener("catalogue-app-back-not-handled", handleCatalogueAppBackFallback);

    return () => {
      if (removeListener) removeListener();
      window.removeEventListener("catalogue-app-back-not-handled", handleCatalogueAppBackFallback);
    };
  }, [location, navigate, isRendering, showTutorial]);

  // Listen for render request from watermark settings and other components
  // Auto-dismiss render result popup after 5 seconds
  useEffect(() => {
    if (renderResult) {
      if (renderResultTimeoutRef.current) {
        clearTimeout(renderResultTimeoutRef.current);
      }
      renderResultTimeoutRef.current = setTimeout(() => {
        setRenderResult(null);
      }, 5000);
    }
    return () => {
      if (renderResultTimeoutRef.current) {
        clearTimeout(renderResultTimeoutRef.current);
      }
    };
  }, [renderResult]);

  useEffect(() => {
    const handleRequestRenderAllPNGs = () => {
      handleRenderPNGs();
    };

    const handleRequestRenderSelectedPNGs = (event: any) => {
      const { products, showOverlay = true } = event.detail;
      if (products && products.length > 0) {
        handleRenderPNGs(products, showOverlay);
      }
    };

    window.addEventListener("requestRenderAllPNGs", handleRequestRenderAllPNGs);
    window.addEventListener("requestRenderSelectedPNGs", handleRequestRenderSelectedPNGs);
    return () => {
      window.removeEventListener("requestRenderAllPNGs", handleRequestRenderAllPNGs);
      window.removeEventListener("requestRenderSelectedPNGs", handleRequestRenderSelectedPNGs);
    };
  }, [handleRenderPNGs]);

  useEffect(() => {
    if (isNative) {
      // Request permissions for local notifications
      LocalNotifications.requestPermissions().then((permission) => {
        console.log("✅ Local notification permission requested:", permission);
      }).catch((error) => {
        console.error("❌ Failed to request local notification permissions:", error);
      });
    }
  }, [isNative]);

  return (
    <div
      style={{
        boxSizing: "border-box",
        height: "100%",
        backgroundColor: "#fff",
      }}
    >
      <ToastContainer />
      <SyncStatusIndicator />
      <OfflineStatusIndicator />
      {showFirstSyncBanner && (
        <div className="fixed top-[40px] inset-x-0 z-[60] px-4">
          <div className="mx-auto max-w-md bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-xs flex items-center justify-between shadow-sm">
            <span className="pr-3">
              We found your existing products on this device and are syncing them securely to your account.
            </span>
            <button
              onClick={() => setShowFirstSyncBanner(false)}
              className="text-[11px] font-semibold text-blue-800 hover:text-blue-900"
            >
              OK
            </button>
          </div>
        </div>
      )}
      <RenderingOverlay
        visible={isRendering}
        current={renderProgress}
        total={renderingTotal}
      />

      {/* Global Success/Error Popup after rendering completes */}
      {renderResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full text-center">
            <div className="flex justify-center mb-4">
              {renderResult.status === "success" ? (
                <FiCheckCircle className="w-12 h-12 text-green-500" />
              ) : (
                <FiAlertCircle className="w-12 h-12 text-red-500" />
              )}
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {renderResult.status === "success" ? "Success!" : "Failed"}
            </h2>

            <p className="text-sm text-gray-600 mb-5">
              {renderResult.message}
            </p>

            <button
              onClick={() => {
                if (renderResultTimeoutRef.current) {
                  clearTimeout(renderResultTimeoutRef.current);
                }
                setRenderResult(null);
              }}
              className="px-6 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} />
      )}

      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Public Routes */}
        <Route path="/o/:token" element={<OrderForm />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/website" element={<Website />} />

        {/* Protected Routes */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <Welcome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <CatalogueApp
                products={products}
                setProducts={setProducts}
                deletedProducts={deletedProducts}
                setDeletedProducts={setDeletedProducts}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                isRendering={isRendering}
                setIsRendering={setIsRendering}
                renderProgress={renderProgress}
                setRenderProgress={setRenderProgress}
                renderingTotal={renderingTotal}
                setRenderingTotal={setRenderingTotal}
                renderResult={renderResult}
                setRenderResult={setRenderResult}
                showTutorial={showTutorial}
                setShowTutorial={setShowTutorial}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreateProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shelf"
          element={
            <ProtectedRoute>
              <Shelf
                deletedProducts={deletedProducts}
                setDeletedProducts={setDeletedProducts}
                setProducts={setProducts}
                products={products}
                imageMap={imageMap}
                user={user}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail"
          element={
            <ProtectedRoute>
              <Retail products={products} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings
                darkMode={darkMode}
                setDarkMode={setDarkMode as any}
                products={products}
                setProducts={setProducts as any}
                deletedProducts={deletedProducts}
                setDeletedProducts={setDeletedProducts as any}
                isRendering={isRendering}
                setIsRendering={setIsRendering as any}
                renderProgress={renderProgress}
                setRenderProgress={setRenderProgress as any}
                showTutorial={showTutorial}
                setShowTutorial={setShowTutorial}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/appearance"
          element={
            <ProtectedRoute>
              <AppearanceSettings darkMode={darkMode} setDarkMode={setDarkMode as any} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/themes"
          element={
            <ProtectedRoute>
              <ThemesSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/watermark"
          element={
            <ProtectedRoute>
              <WatermarkSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/fields"
          element={
            <ProtectedRoute>
              <FieldsSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/currency"
          element={
            <ProtectedRoute>
              <CurrencySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/pro"
          element={
            <ProtectedRoute>
              <ProInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <Router>
                <AppWithBackHandler />
              </Router>
            </SubscriptionProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
