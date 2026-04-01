import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
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
import { SplashScreen } from '@capacitor/splash-screen';
import { initializeFieldSystem } from "./config/initializeFields";
import { getFieldsDefinition, setFieldsDefinition } from "./config/fieldConfig";
import {
  runMigrations,
  migrateUnkeyedDataToUserKeyed,
  migrateProductImagePaths,
  migrateLegacyRenderedImagesToUserFolder,
} from "./utils/dataMigration";
import { LocalNotifications } from '@capacitor/local-notifications';
import { initializeFirebaseMessaging } from "./services/firebaseService";
import { readProductSourceBase64ForCloudUpload } from "./utils/productSourceImage";
import { assertProductsHaveCloudImageUrlForSync } from "./utils/syncImageValidation";
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from "./utils/safeStorage";
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { useAuth } from "./context/AuthContext";
import { useSync, applyUserSettingsFromCloud } from "./context/SyncContext";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import { supabase } from "./supabaseClient";

import CatalogueApp from "./CatalogueApp";
const CreateProduct = lazy(() => import("./CreateProduct"));
const Shelf = lazy(() => import("./Shelf"));
const Retail = lazy(() => import("./Retail"));
const Settings = lazy(() => import("./Settings"));
const AppearanceSettings = lazy(() => import("./pages/AppearanceSettings"));
const ThemesSettings = lazy(() => import("./pages/ThemesSettings"));
const WatermarkSettings = lazy(() => import("./pages/WatermarkSettings"));
const FieldsSettings = lazy(() => import("./pages/FieldsSettings"));
const CurrencySettings = lazy(() => import("./pages/CurrencySettings"));
const ProInfo = lazy(() => import("./pages/ProInfo"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Account = lazy(() => import("./pages/Account"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderForm = lazy(() => import("./pages/OrderForm"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy"));
const TermsOfService = lazy(() => import("./TermsOfService"));
const Website = lazy(() => import("./Website"));
const Tutorial = lazy(() => import("./Tutorial"));
import { ToastProvider, useToast } from "./context/ToastContext";
import { ToastContainer } from "./components/ToastContainer";
import { AuthProvider } from "./context/AuthContext";
import { SyncProvider } from "./context/SyncContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SplashLoadingLayout } from "./components/SplashLoadingLayout";
import { authService } from "./services/authService";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import RenderingOverlay from "./RenderingOverlay";
import ErrorBoundary from "./components/ErrorBoundary";
import { saveRenderedImage } from "./Save";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { getAllCatalogues, getCataloguesDefinition, setCataloguesDefinition } from "./config/catalogueConfig";
import { ThemeProvider } from "./context/ThemeContext";
import GlassThemeProGate from "./components/GlassThemeProGate";
import { SyncProgressModal } from "./components/SyncProgressModal";
import { SyncBusyOverlay } from "./components/SyncBusyOverlay";

/** Run non-critical work after first paint to shorten time-to-interactive. */
function scheduleIdleTask(fn: () => void) {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => fn(), { timeout: 4000 });
  } else {
    window.setTimeout(fn, 1);
  }
}

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white" role="status" aria-label="Loading">
      <div className="h-9 w-9 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function AppWithBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { user, loading, supabaseData, supabaseDataLoading } = useAuth();
  const {
    isSyncing: isSyncContextSyncing,
    syncStatusDetail,
    syncProgressPercent: syncContextProgressPercent,
    syncProductsToCloud,
    refreshFromCloud,
    isStrictMode,
  } = useSync();
  const [imageMap, setImageMap] = useState({});
  const [products, setProducts] = useState<any[]>([]);
  const [deletedProducts, setDeletedProducts] = useState<any[]>([]);
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
  const [showOfflineSyncModal, setShowOfflineSyncModal] = useState(false);
  const [syncNowLoading, setSyncNowLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncProgressPercent, setSyncProgressPercent] = useState(0);

  useEffect(() => {
    (window as unknown as { __offlineSyncInProgress?: boolean }).__offlineSyncInProgress =
      syncNowLoading;
  }, [syncNowLoading]);

  // Startup pipeline state: gates everything until legacy offline data is resolved.
  // 'pending' = haven't checked yet, 'resolving' = popup shown / sync in progress,
  // 'done' = resolved (either synced, deleted, or no offline data).
  const [startupPhase, setStartupPhase] = useState<'pending' | 'resolving' | 'done'>('pending');
  const startupRanForUserRef = useRef<string | null>(null);

  const isHomeRoute = location.pathname === '/' || location.pathname === '';
  const isGuestUser = authService.isOfflineGuest() || Boolean(user?.isAnonymous);
  // Gate on startup phase only — not supabaseDataLoading, so cached local rows can show while cloud finishes.
  const showCloudBootstrapOverlay =
    isHomeRoute &&
    !!user &&
    !isGuestUser &&
    !showOfflineSyncModal &&
    startupPhase === "pending";

  const isNative = Capacitor.getPlatform() !== "web";

  // Never re-show the native Capacitor splash (logo-only). Cold start uses a plain white window (Android styles);
  // loading UX is SplashLoadingLayout / auth UI inside the WebView.
  useEffect(() => {
    if (!isNative) {
      SplashScreen.hide().catch(() => {});
      return;
    }
    SplashScreen.hide().catch(() => {});
  }, [isNative]);

  const getProductsKey = (uid: string) => getStorageKey('products', uid);
  const getDeletedProductsKey = (uid: string) => getStorageKey('deletedProducts', uid);

  const clearAllOfflineCaches = useCallback(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('products::') || k.startsWith('deletedProducts::')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('products');
    localStorage.removeItem('deletedProducts');
    localStorage.removeItem('retailProducts');
  }, []);

  const clearLegacyUnkeyedProductCaches = useCallback(() => {
    localStorage.removeItem('products');
    localStorage.removeItem('deletedProducts');
    localStorage.removeItem('retailProducts');
  }, []);

  // ──────────────────────────────────────────────────────
  // SINGLE SEQUENTIAL STARTUP PIPELINE
  // Runs once per user login. All decisions happen here in order.
  // No other useEffect touches products/deletedProducts until startupPhase === 'done'.
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) {
      setStartupPhase('pending');
      startupRanForUserRef.current = null;
      setProducts([]);
      setDeletedProducts([]);
      return;
    }
    if (supabaseDataLoading) return;

    const userId = user.uid;

    // Only run once per user
    if (startupRanForUserRef.current === userId) return;
    startupRanForUserRef.current = userId;

    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      // Guest users: load local data, skip everything else.
      const guestProducts = safeGetFromStorage(getProductsKey(userId), []);
      const guestDeleted = safeGetFromStorage(getDeletedProductsKey(userId), []);
      setProducts(guestProducts);
      setDeletedProducts(guestDeleted);
      setStartupPhase('done');
      return;
    }

    // Wipe legacy unkeyed caches from any previous user on this device.
    if (previousUserIdRef.current && previousUserIdRef.current !== userId) {
      clearLegacyUnkeyedProductCaches();
    }
    previousUserIdRef.current = userId;

    // Step 1: Run data migration (moves unkeyed localStorage to keyed).
    migrateUnkeyedDataToUserKeyed(userId);

    // Step 2: Check if strict online mode is already enabled (returning user).
    const strictAlreadyEnabled = localStorage.getItem('strictOnlineMode::device') === 'true';
    const legacyResolved = localStorage.getItem('offlineLegacyResolved::device') === 'true';

    if (strictAlreadyEnabled && legacyResolved) {
      // Returning strict-mode user: apply auth snapshot, then wait for full cloud refresh
      // (image cache + storage) before ending startup — keeps splash up until catalogue is ready.
      void (async () => {
        try {
          const cloudProducts = Array.isArray(supabaseData?.products) ? supabaseData!.products : [];
          const cloudDeleted = Array.isArray(supabaseData?.deletedProducts) ? supabaseData!.deletedProducts : [];
          const deletedIds = new Set(cloudDeleted.map((p: any) => p.id));
          const filteredProducts = cloudProducts.filter((p: any) => !deletedIds.has(p.id));

          setProducts(filteredProducts);
          safeSetInStorage(getProductsKey(userId), filteredProducts);
          setDeletedProducts(cloudDeleted);
          safeSetInStorage(getDeletedProductsKey(userId), cloudDeleted);

          const rawCats = supabaseData?.categories || [];
          const normalizedCats = rawCats.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
          localStorage.setItem('categories', JSON.stringify(normalizedCats));
          if (supabaseData?.fieldsDefinition) {
            setFieldsDefinition(supabaseData.fieldsDefinition, userId);
            window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
              detail: { newDefinition: supabaseData.fieldsDefinition, template: supabaseData.fieldsDefinition?.industry || 'Custom', isBackupRestore: false }
            }));
          }
          if (supabaseData?.cataloguesDefinition) {
            setCataloguesDefinition(supabaseData.cataloguesDefinition, userId);
            window.dispatchEvent(new CustomEvent('catalogues-changed', {
              detail: { action: 'update', catalogues: supabaseData.cataloguesDefinition.catalogues }
            }));
          }
          applyUserSettingsFromCloud(supabaseData?.userSettings);

          try {
            const cloudData = await refreshFromCloud();
            if (cloudData) {
              setProducts(cloudData.products);
              setDeletedProducts(cloudData.deletedProducts);
            }
          } catch (e) {
            console.warn('⚠️ refreshFromCloud failed (using auth snapshot):', e);
          }
          setSupabaseSyncStatus('synced');
        } catch (e) {
          console.error('❌ Strict startup bootstrap failed:', e);
        } finally {
          setStartupPhase('done');
        }
      })();
      return;
    }

    // Step 3: Check for legacy offline data (ANY type, not just products).
    const hasLegacyProducts = (() => {
      const kp = safeGetFromStorage(getProductsKey(userId), []);
      return Array.isArray(kp) && kp.length > 0;
    })();
    const hasLegacyDeleted = (() => {
      const kd = safeGetFromStorage(getDeletedProductsKey(userId), []);
      return Array.isArray(kd) && kd.length > 0;
    })();
    const hasLegacyCategories = (() => {
      try {
        const keyed = localStorage.getItem(getStorageKey('categories', userId));
        const unkeyed = localStorage.getItem('categories');
        const c = JSON.parse(keyed || unkeyed || '[]');
        return Array.isArray(c) && c.length > 0;
      } catch { return false; }
    })();
    const hasLegacyFields = !!getFieldsDefinition(userId);
    const hasLegacyCatalogues = !!getCataloguesDefinition(userId);
    const hasAnyOfflineData = hasLegacyProducts || hasLegacyDeleted || hasLegacyCategories || hasLegacyFields || hasLegacyCatalogues;

    if (!legacyResolved && hasAnyOfflineData) {
      // Step 3a: Offline data found, needs resolution. Show popup and block.
      setStartupPhase('resolving');
      setShowOfflineSyncModal(true);

      // Load local data so user can see what they have while deciding.
      const localP = safeGetFromStorage(getProductsKey(userId), []);
      const localD = safeGetFromStorage(getDeletedProductsKey(userId), []);
      setProducts(localP);
      setDeletedProducts(localD);
      console.log('⏳ [startup] Offline data detected, awaiting user decision');
      return;
    }

    // Step 4: No offline data (or already resolved but strict not enabled yet).
    // This is a new user or a user whose legacy was already handled.
    // Apply Supabase data normally (merge for non-strict, or just load).
    const localProducts = safeGetFromStorage(getProductsKey(userId), []);
    const localDeleted = safeGetFromStorage(getDeletedProductsKey(userId), []);

    if (supabaseData?.products && supabaseData.products.length > 0) {
      const currentDeletedIds = new Set<string>();
      for (const p of localDeleted) {
        if (p?.id != null) currentDeletedIds.add(String(p.id));
      }
      for (const p of supabaseData.deletedProducts || []) {
        if (p?.id != null) currentDeletedIds.add(String(p.id));
      }
      const merged = mergeProductsData(localProducts, supabaseData.products, currentDeletedIds);
        setProducts(merged);
      safeSetInStorage(getProductsKey(userId), merged);
    } else {
      setProducts(localProducts);
      }

    if (supabaseData?.deletedProducts && supabaseData.deletedProducts.length > 0) {
      const merged = mergeProductsData(localDeleted, supabaseData.deletedProducts);
        setDeletedProducts(merged);
      safeSetInStorage(getDeletedProductsKey(userId), merged);
    } else {
      setDeletedProducts(localDeleted);
      }

    if (supabaseData?.fieldsDefinition && Array.isArray(supabaseData.fieldsDefinition?.fields)) {
        const localFieldsDef = getFieldsDefinition();
        const remoteFieldsDef = supabaseData.fieldsDefinition;
        const localLastUpdated = localFieldsDef?.lastUpdated ? new Date(localFieldsDef.lastUpdated).getTime() : 0;
        const remoteLastUpdated = remoteFieldsDef?.lastUpdated ? new Date(remoteFieldsDef.lastUpdated).getTime() : 0;
        if (remoteLastUpdated > localLastUpdated) {
          setFieldsDefinition(remoteFieldsDef);
          window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
          detail: { newDefinition: remoteFieldsDef, template: remoteFieldsDef?.industry || 'Custom', isBackupRestore: false }
          }));
        }
      }

    if (supabaseData?.cataloguesDefinition) {
        const localCataloguesDef = getCataloguesDefinition();
        const remoteCataloguesDef = supabaseData.cataloguesDefinition;
        const localLastUpdated = localCataloguesDef?.lastUpdated ? new Date(localCataloguesDef.lastUpdated).getTime() : 0;
        const remoteLastUpdated = remoteCataloguesDef?.lastUpdated ? new Date(remoteCataloguesDef.lastUpdated).getTime() : 0;
        if (remoteLastUpdated > localLastUpdated) {
          setCataloguesDefinition(remoteCataloguesDef);
          window.dispatchEvent(new CustomEvent('catalogues-changed', {
          detail: { action: 'update', catalogues: remoteCataloguesDef.catalogues }
          }));
        }
      }

    // Enable strict mode for all authenticated users going forward.
    localStorage.setItem('strictOnlineMode::device', 'true');
    localStorage.setItem('offlineLegacyResolved::device', 'true');
      setSupabaseSyncStatus('synced');
    setStartupPhase('done');
    console.log('✅ [startup] Normal user startup complete');
  }, [loading, user?.uid, supabaseData, supabaseDataLoading, clearLegacyUnkeyedProductCaches, refreshFromCloud]);

  // Strict-mode: hydrate React state from local cache while Supabase profile is still loading.
  // Do not call setStartupPhase('done') here — that stays tied to the main pipeline so the splash
  // stays until refreshFromCloud() has applied the full catalogue (avoids empty dashboard flash).
  useEffect(() => {
    if (loading || !user?.uid) return;
    if (localStorage.getItem("isOfflineGuest") === "true") return;
    const strict =
      localStorage.getItem("strictOnlineMode::device") === "true" &&
      localStorage.getItem("offlineLegacyResolved::device") === "true";
    if (!strict || !supabaseDataLoading) return;
    const uid = user.uid;
    const localP = safeGetFromStorage(getStorageKey("products", uid), []);
    const localD = safeGetFromStorage(getStorageKey("deletedProducts", uid), []);
    if (localP.length === 0 && localD.length === 0) return;
    setProducts(localP);
    setDeletedProducts(localD);
  }, [loading, user?.uid, supabaseDataLoading]);

  // ──────────────────────────────────────────────────────
  // SYNC OFFLINE DATA (called when user taps "Sync" in the popup)
  // ──────────────────────────────────────────────────────
  const syncOfflineDataNow = useCallback(async () => {
    if (!user?.uid) return;
    setSyncNowLoading(true);
    setSyncProgressPercent(0);
    setSyncProgress('');
    if (Capacitor.isNativePlatform()) {
      KeepAwake.keepAwake().catch(() => {});
    }
    try {
      const userId = user.uid;
      const parseStoredJsonArray = (raw: string | null): any[] => {
        if (!raw) return [];
        try {
          const p = JSON.parse(raw);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      };

      let localProducts = safeGetFromStorage(getProductsKey(userId), []);
      let localDeleted = safeGetFromStorage(getDeletedProductsKey(userId), []);
      const unkeyedProducts = parseStoredJsonArray(localStorage.getItem('products'));
      const unkeyedDeleted = parseStoredJsonArray(localStorage.getItem('deletedProducts'));
      if (unkeyedProducts.length > 0) {
        localProducts = mergeProductsData(localProducts, unkeyedProducts, new Set());
      }
      if (unkeyedDeleted.length > 0) {
        localDeleted = mergeProductsData(localDeleted, unkeyedDeleted, new Set());
      }

      const {
        fetchAllUserData,
        syncProducts,
        syncDeletedProducts,
        syncCategories,
        syncCataloguesDefinition,
        syncFieldsDefinition,
        syncUserSettings,
        removeFromProductsTable,
        removeFromDeletedProductsTable,
      } = await import('./services/supabaseSync');

      const setSyncPhase = (percent: number, detail: string) => {
        const p = Math.min(100, Math.max(0, Math.round(percent)));
        setSyncProgressPercent(p);
        setSyncProgress(detail);
      };

      // Helper: upload missing R2 images (Data + External + legacy paths; fail if image cannot be cloud-linked)
      const uploadMissingImages = async (
        items: any[],
        label: string,
        opts?: { percentFrom: number; percentTo: number; detailPrefix: string }
      ): Promise<any[]> => {
        const missing = items.filter((p: any) => {
          const hasHttps =
            typeof p.imageUrl === 'string' && /^https?:\/\//i.test(p.imageUrl.trim());
          return !hasHttps && p.imagePath;
        });
        const from = opts?.percentFrom ?? 8;
        const to = opts?.percentTo ?? 28;
        const prefix = opts?.detailPrefix ?? 'Uploading images';

        if (missing.length === 0) {
          if (opts) setSyncPhase(to, `${prefix} — nothing to upload`);
          return items;
        }

        const { uploadProductImageToR2 } = await import('./services/r2Upload');

        if (!Capacitor.isNativePlatform()) {
          assertProductsHaveCloudImageUrlForSync(items, label);
          if (opts) setSyncPhase(to, `${prefix} — ready`);
          return items;
        }

        const uploadedPairs: { productId: string; imageUrl: string }[] = [];
        for (let i = 0; i < missing.length; i++) {
          const p = missing[i];
          let base64: string | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            base64 = await readProductSourceBase64ForCloudUpload(p);
            if (base64) break;
            if (attempt < 2) await new Promise((r) => setTimeout(r, 180));
          }
          if (!base64) {
            throw new Error(
              `[${label}] Cannot read image file for product "${p.name || p.id}" (${p.id}).`
            );
          }
          const pathHint =
            typeof p.imagePath === 'string' && p.imagePath.trim() ? p.imagePath.trim() : '';
          const filename = (pathHint.split('/').pop() || 'product.png').toLowerCase();
          const dataUrlPrefix = filename.endsWith('.jpg') || filename.endsWith('.jpeg')
            ? 'data:image/jpeg;base64,'
            : 'data:image/png;base64,';
          const uploaded = await uploadProductImageToR2({
            productId: String(p.id),
            dataUrl: `${dataUrlPrefix}${base64}`,
          });
          if (!uploaded?.url) {
            throw new Error(`[${label}] Cloud upload returned no URL for product ${p.id}`);
          }
          uploadedPairs.push({ productId: String(p.id), imageUrl: uploaded.url });
          const done = i + 1;
          const span = Math.max(0, to - from);
          const pct = from + Math.round((done / missing.length) * span);
          setSyncPhase(
            pct,
            `${prefix} (${done}/${missing.length})${p.name ? ` · ${p.name}` : ''}`
          );
        }

        const urlMap = new Map(uploadedPairs.map((x: any) => [String(x.productId), x.imageUrl]));
        const merged = items.map((p: any) => {
          const url = urlMap.get(String(p.id));
          return url ? { ...p, imageUrl: url } : p;
        });
        assertProductsHaveCloudImageUrlForSync(merged, label);
        return merged;
      };

      setSyncPhase(0, 'Preparing…');
      await new Promise((r) => requestAnimationFrame(r));
      setSyncPhase(5, 'Uploading product images…');
      localProducts = await uploadMissingImages(
        Array.isArray(localProducts) ? localProducts : [],
        'active',
        { percentFrom: 6, percentTo: 26, detailPrefix: 'Uploading product images' }
      );
      safeSetInStorage(getProductsKey(userId), localProducts);

      setSyncPhase(28, 'Uploading shelf images…');
      let localDeletedUpdated = await uploadMissingImages(
        Array.isArray(localDeleted) ? localDeleted : [],
        'shelf',
        { percentFrom: 28, percentTo: 40, detailPrefix: 'Uploading shelf images' }
      );

      setSyncPhase(42, 'Syncing categories…');
      let localCategories: any[] = [];
      try {
        const keyed = localStorage.getItem(getStorageKey('categories', userId));
        const unkeyed = localStorage.getItem('categories');
        const raw = JSON.parse(keyed || unkeyed || '[]');
        localCategories = Array.isArray(raw) ? raw : [];
      } catch { localCategories = []; }

      // Read catalogues/fields from keyed storage, fall back to unkeyed for legacy
      let localCataloguesDefinition = getCataloguesDefinition(userId);
      if (!localCataloguesDefinition || !localCataloguesDefinition.catalogues?.length) {
        const unkeyedCat = localStorage.getItem('cataloguesDefinition');
        if (unkeyedCat) {
          try { localCataloguesDefinition = JSON.parse(unkeyedCat); } catch { /* keep default */ }
        }
      }
      let localFieldsDefinition = getFieldsDefinition(userId);
      if (!localFieldsDefinition) {
        const unkeyedFields = localStorage.getItem('fieldsDefinition');
        if (unkeyedFields) {
          try { localFieldsDefinition = JSON.parse(unkeyedFields); } catch { /* keep null */ }
        }
      }

      const localShowWatermark = safeGetFromStorage('showWatermark', true);
      const localWatermarkText = safeGetFromStorage('watermarkText', 'Created using CatShare');
      const localWatermarkPosition = safeGetFromStorage('watermarkPosition', 'bottom-left');
      const localCurrency = localStorage.getItem('defaultCurrency') || 'INR';
      const localPriceUnits = safeGetFromStorage('priceFieldUnits', ['/ piece', '/ dozen', '/ set', '/ kg']);
      const localCustomCurrencies = safeGetFromStorage('customCurrencies', {});

      {
        const categoriesForSync = localCategories.map((cat: any) =>
          typeof cat === 'string' ? { id: cat, name: cat } : cat
        );
        const res = await syncCategories(userId, categoriesForSync);
        if (!res.success) throw new Error(res.error || 'Categories sync failed');
      }

      setSyncProgress('Syncing catalogues...');
      if (localCataloguesDefinition) {
        const res = await syncCataloguesDefinition(userId, localCataloguesDefinition);
        if (!res.success) throw new Error(res.error || 'Catalogues definition sync failed');
      }

      setSyncProgress('Syncing fields...');
      if (localFieldsDefinition) {
        const res = await syncFieldsDefinition(userId, localFieldsDefinition);
        if (!res.success) throw new Error(res.error || 'Fields definition sync failed');
      }

      setSyncProgress('Syncing settings...');
      {
        const res = await syncUserSettings(userId, {
          watermark_enabled: !!localShowWatermark,
          watermark_text: localWatermarkText,
          currency: localCurrency,
          price_units: localPriceUnits,
          data: { watermarkPosition: localWatermarkPosition, customCurrencies: localCustomCurrencies },
        });
        if (!res.success) throw new Error(res.error || 'User settings sync failed');
      }

      setSyncPhase(68, 'Fetching cloud snapshot…');
      const remoteSnapshot = await fetchAllUserData(userId);
      if (!remoteSnapshot.success || !remoteSnapshot.data) {
        throw new Error(remoteSnapshot.error || 'Failed to fetch remote snapshot for merge');
      }
      const remoteProducts = Array.isArray(remoteSnapshot.data.products) ? remoteSnapshot.data.products : [];
      const remoteDeleted = Array.isArray(remoteSnapshot.data.deletedProducts) ? remoteSnapshot.data.deletedProducts : [];
      const deletedIds = new Set<string>();
      for (const p of localDeletedUpdated) {
        if (p?.id != null) deletedIds.add(String(p.id));
      }
      for (const p of remoteDeleted) {
        if (p?.id != null) deletedIds.add(String(p.id));
      }
      const localProductsFiltered = localProducts.filter(
        (p: any) => p?.id != null && !deletedIds.has(String(p.id))
      );
      const mergedProducts = mergeProductsData(localProductsFiltered, remoteProducts, deletedIds);
      const mergedDeleted = mergeProductsData(localDeletedUpdated, remoteDeleted);

      setSyncPhase(74, 'Syncing products to cloud…');
      {
        const res = await syncProducts(userId, mergedProducts);
        if (!res.success) throw new Error(res.error || 'Products sync failed');
      }
      setSyncPhase(80, 'Syncing removed items to cloud…');
      {
        const res = await syncDeletedProducts(userId, mergedDeleted);
        if (!res.success) throw new Error(res.error || 'Deleted products sync failed');
      }

      // Cleanup: remove shelved products from products table,
      // and active products from deleted_products table.
      const activeIds = new Set(mergedProducts.map((p: any) => String(p.id)));
      const deletedIdsSet = new Set(mergedDeleted.map((p: any) => String(p.id)));
      const idsToRemoveFromProducts = mergedDeleted
        .map((p: any) => String(p.id))
        .filter((id: string) => !activeIds.has(id));
      const idsToRemoveFromDeleted = mergedProducts
        .map((p: any) => String(p.id))
        .filter((id: string) => !deletedIdsSet.has(id));
      await Promise.all([
        removeFromProductsTable(userId, idsToRemoveFromProducts),
        removeFromDeletedProductsTable(userId, idsToRemoveFromDeleted),
      ]);

      setSyncProgress('Refreshing from cloud...');
      // Fetch fresh snapshot from cloud as the single source of truth.
      // Live per-product lines while native image cache runs (modal subtitle).
      const cloudData = await refreshFromCloud({
        onStatus: (msg) => setSyncProgress(msg),
      });
      if (cloudData) {
        setProducts(cloudData.products);
        setDeletedProducts(cloudData.deletedProducts);
      }

      localStorage.setItem(`cloudSyncDone::${userId}`, 'true');
      // Clean up unkeyed legacy originals now that cloud sync succeeded.
      localStorage.removeItem('products');
      localStorage.removeItem('deletedProducts');
      // Do NOT remove `categories` here — refreshFromCloud() just wrote it; removing caused empty UI / slow repopulate.
      localStorage.removeItem('cataloguesDefinition');
      localStorage.removeItem('fieldsDefinition');
      localStorage.setItem('offlineLegacyResolved::device', 'true');
      localStorage.setItem('strictOnlineMode::device', 'true');
      clearAllOfflineCaches();

      setSyncPhase(100, 'Done');
      setShowOfflineSyncModal(false);
      setStartupPhase('done');
      setSyncProgress('');
      setSyncProgressPercent(0);
      console.log('✅ Offline data synced to account');
    } catch (err: any) {
      console.error('❌ Sync failed:', err);
      setSyncProgress('');
      setSyncProgressPercent(0);
      showToast(
        `Sync failed: ${err?.message || 'Unknown error'}. Please try again.`,
        'error',
        8000
      );
    } finally {
      setSyncNowLoading(false);
      if (Capacitor.isNativePlatform()) {
        KeepAwake.allowSleep().catch(() => {});
      }
    }
  }, [user, clearAllOfflineCaches, refreshFromCloud, showToast]);

  // ──────────────────────────────────────────────────────
  // R2 CLEANUP QUEUE (process orphaned images on startup)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (startupPhase !== 'done' || !user?.uid) return;
    import('./services/supabaseSync').then(({ processR2CleanupQueue }) => {
      processR2CleanupQueue(user.uid).catch(() => {});
    });
  }, [startupPhase, user?.uid]);

  // ──────────────────────────────────────────────────────
  // ONBOARDING REDIRECT (only after startup pipeline is done)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (startupPhase !== 'done') return;

    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) return;
    if (!user?.uid) return;

    const isNewUser = !supabaseData?.fieldsDefinition;
    const hasLocalFields = !!getFieldsDefinition(user.uid);
    const hasCompletedOnboarding = safeGetFromStorage('hasCompletedOnboarding', false);

    const publicPages = ['/welcome', '/login', '/register', '/forgot-password', '/privacy', '/terms', '/website', '/o/'];
    const isOnPublicPage = publicPages.some(p => location.pathname.includes(p));

    if (isNewUser && !hasLocalFields && !hasCompletedOnboarding && !isOnPublicPage) {
      navigate('/welcome');
    }
  }, [navigate, location.pathname, loading, startupPhase, supabaseData?.fieldsDefinition, user?.uid]);

  // ──────────────────────────────────────────────────────
  // PRODUCT-ADDED EVENT: reload products from localStorage
  // (fired by CreateProduct after saving)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleNewProduct = async (e?: Event) => {
      if (!user?.uid) return;
      // Backup restore dispatches product-added before its own detailed sync; avoid grabbing
      // the sync lock here or restore would show Lottie and skip detailedStatus.
      const skipStrictSync = (e as CustomEvent<{ skipStrictSync?: boolean }> | undefined)?.detail
        ?.skipStrictSync;
      if (skipStrictSync) return;

      const freshProducts = safeGetFromStorage(getProductsKey(user.uid), []);
      const freshDeleted = safeGetFromStorage(getDeletedProductsKey(user.uid), []);

      if (isStrictMode()) {
        try {
          const cloudData = await syncProductsToCloud(freshProducts, freshDeleted);
          setProducts(cloudData.products);
          setDeletedProducts(cloudData.deletedProducts);
        } catch (err: any) {
          console.error('❌ Strict sync after product-added failed:', err?.message);
          setProducts(freshProducts);
        }
      } else {
        setProducts(freshProducts);
      }
    };
    window.addEventListener("product-added", handleNewProduct);
    return () => window.removeEventListener("product-added", handleNewProduct);
  }, [user?.uid, syncProductsToCloud, isStrictMode]);

  // ──────────────────────────────────────────────────────
  // STRICT REFRESH EVENT: child components dispatch this after
  // their own awaited sync (definitions, settings, etc.)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleStrictRefresh = async () => {
      if (!isStrictMode()) return;
      if (!user?.uid) return;
      try {
        const cloudData = await refreshFromCloud();
        if (cloudData) {
          setProducts(cloudData.products);
          setDeletedProducts(cloudData.deletedProducts);
        }
      } catch (e) {
        console.error('❌ strict-refresh-from-cloud failed:', e);
      }
    };
    window.addEventListener('strict-refresh-from-cloud', handleStrictRefresh as any);
    return () => window.removeEventListener('strict-refresh-from-cloud', handleStrictRefresh as any);
  }, [refreshFromCloud, isStrictMode, user?.uid]);

  // ──────────────────────────────────────────────────────
  // PERSIST products/deletedProducts to localStorage on change
  // (but NO auto-sync to Supabase -- that's done at mutation points)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const cleanedProducts = products.map(p => {
      const clean = { ...p };
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
      if (!clean.updatedAt) clean.updatedAt = new Date().toISOString();
      return clean;
    });
    safeSetInStorage(getProductsKey(user.uid), cleanedProducts);
  }, [products, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const cleanedDeleted = deletedProducts.map(p => {
      const clean = { ...p };
      delete clean.image;
      delete clean.imageBase64;
      delete clean.imageData;
      delete clean.imageFilename;
      delete clean.renderedImages;
      return clean;
    });
    safeSetInStorage(getDeletedProductsKey(user.uid), cleanedDeleted);
  }, [deletedProducts, user?.uid]);

  const mergeProductsData = (local: any[], remote: any[], deletedIds: Set<string> = new Set()) => {
    const merged = new Map<string, any>();
    local.forEach((product) => {
      if (product?.id == null) return;
      merged.set(String(product.id), product);
    });
    remote.forEach((remoteProduct) => {
      if (remoteProduct?.id == null) return;
      if (deletedIds.size > 0 && deletedIds.has(String(remoteProduct.id))) return;
      const id = String(remoteProduct.id);
      const localProduct = merged.get(id);
      if (!localProduct) {
        merged.set(id, remoteProduct);
      } else {
        const localTime = new Date(localProduct.updatedAt || 0).getTime();
        const remoteTime = new Date(remoteProduct.updatedAt || 0).getTime();
        if (remoteTime > localTime) merged.set(id, remoteProduct);
      }
    });
    return Array.from(merged.values());
  };

  // Handle rendering images with chunked processing to prevent UI freeze
  // Processes in small batches with UI yielding between chunks
  const handleRenderPNGs = useCallback(async (customProducts?: any[], showOverlay: boolean = true) => {
    // Rendering must use the currently logged-in user's products (keyed storage / state),
    // otherwise images may render with missing file paths.
    const all = customProducts || products || [];
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
  }, [isNative, products]);

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

  // Initialize Firebase messaging for notifications (deferred — not needed for first paint).
  useEffect(() => {
    let cancelled = false;

    const setupFirebase = async () => {
      if (cancelled) return;
      if (!localStorage.getItem("userId")) {
        localStorage.setItem("userId", `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      }

      if (isNative) {
        try {
          await FirebaseAnalytics.setEnabled({ enabled: true });
          await FirebaseAnalytics.logEvent({ name: "app_open" });

          // Update last_seen on every app open
if (user?.uid && !authService.isOfflineGuest()) {
  supabase
    .from('user_settings')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', user.uid)
    .then(() => console.log('✅ last_seen updated'));
}

          (window as any).FirebaseAnalytics = {
            logEvent: async (options: { name: string; parameters: Record<string, any> }) => {
              try {
                await FirebaseAnalytics.logEvent(options);
              } catch (error) {
                console.error("Error logging event to Capacitor:", error);
              }
            },
          };
        } catch (error) {
          console.warn("⚠️ Firebase Analytics error on mobile:", error);
        }
      }

      if (!cancelled) await initializeFirebaseMessaging();
    };

    const handleFirebaseNotification = (event: any) => {
      setRenderResult({
        status: "success",
        message: event.detail.body || "Rendering completed successfully!",
      });
      setRenderProgress(100);
    };

    window.addEventListener("firebaseNotification", handleFirebaseNotification);
    scheduleIdleTask(() => {
      void setupFirebase();
    });

    return () => {
      cancelled = true;
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
    let removeListener: any;

    // Handle back button press
    // Note: This listener may be overridden by child components (like CatalogueApp)
    // when they need to handle back navigation within their own context.
    // For home page (/) routes, CatalogueApp handles back navigation and dispatches
    // "catalogue-app-back-not-handled" event when it can't handle it.
    const handleBackPress = () => {
      if (syncNowLoading) {
        return;
      }
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
      if ((window as unknown as { __offlineSyncInProgress?: boolean }).__offlineSyncInProgress) {
        return;
      }
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
  }, [location, navigate, isRendering, showTutorial, syncNowLoading]);

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
    if (!isNative) return;
    scheduleIdleTask(() => {
      LocalNotifications.requestPermissions().catch(() => {});
    });
  }, [isNative]);

  return (
    <div
      style={{
        boxSizing: "border-box",
        height: "100%",
        backgroundColor: "#fff",
      }}
    >
      {/* Offline sync: same progress popup as restore / cloud sync while syncing */}
      {showOfflineSyncModal && user?.uid && syncNowLoading && (
        <SyncProgressModal
          open
          zClassName="z-[120]"
          percent={syncProgressPercent}
          detail={syncProgress || 'Preparing…'}
          title="Syncing to your account"
          helperText="Please keep the app open on this screen until the sync finishes."
        />
      )}

      {/* Offline sync opt-in (choices only when not syncing) */}
      {showOfflineSyncModal && user?.uid && !syncNowLoading && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-label="Offline data"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
              <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl sm:text-xl font-bold text-gray-900 text-center mb-2">Offline data found</h2>
            <p className="text-sm sm:text-base text-gray-600 text-center mb-6">
              We found data on this device from the previous offline version. Would you like to sync it to your account or start fresh?
            </p>

            <div className="space-y-3 mb-4">
              <button
                disabled={syncNowLoading}
                onClick={() => syncOfflineDataNow()}
                className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold text-sm sm:text-base transition-colors"
              >
                {syncNowLoading ? 'Syncing...' : 'Sync to my account'}
              </button>
            </div>

            <div className="border-t border-gray-200 my-4"></div>

              <button
                disabled={syncNowLoading}
              onClick={async () => {
                const ok = window.confirm("Delete offline data permanently? This cannot be undone.");
                if (!ok) return;

                setProducts([]);
                setDeletedProducts([]);
                safeSetInStorage(getProductsKey(user.uid), []);
                safeSetInStorage(getDeletedProductsKey(user.uid), []);

                localStorage.setItem('offlineLegacyResolved::device', 'true');
                localStorage.setItem('strictOnlineMode::device', 'true');
                clearAllOfflineCaches();
                clearLegacyUnkeyedProductCaches();

                localStorage.removeItem('categories');
                localStorage.removeItem('cataloguesDefinition');
                localStorage.removeItem('fieldsDefinition');
                localStorage.removeItem(getStorageKey('categories', user.uid));
                localStorage.removeItem(getStorageKey('cataloguesDefinition', user.uid));
                localStorage.removeItem(getStorageKey('fieldsDefinition', user.uid));
                localStorage.removeItem('showTutorialOnInit');

                // Check if user already has data in the cloud before sending to welcome.
                const hasCloudData = !!(
                  supabaseData?.fieldsDefinition ||
                  (supabaseData?.products && supabaseData.products.length > 0) ||
                  supabaseData?.cataloguesDefinition
                );

                if (hasCloudData) {
                  // User already set up on another device — load from cloud, skip welcome.
                  const cloudProducts = Array.isArray(supabaseData?.products) ? supabaseData!.products : [];
                  const cloudDeleted = Array.isArray(supabaseData?.deletedProducts) ? supabaseData!.deletedProducts : [];
                  const deletedIds = new Set(cloudDeleted.map((p: any) => p.id));
                  const filteredProducts = cloudProducts.filter((p: any) => !deletedIds.has(p.id));
                  setProducts(filteredProducts);
                  setDeletedProducts(cloudDeleted);
                  safeSetInStorage(getProductsKey(user.uid), filteredProducts);
                  safeSetInStorage(getDeletedProductsKey(user.uid), cloudDeleted);

                  const rawCats = supabaseData?.categories || [];
                  const normalizedCats = rawCats.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
                  localStorage.setItem('categories', JSON.stringify(normalizedCats));

                  if (supabaseData?.fieldsDefinition) {
                    setFieldsDefinition(supabaseData.fieldsDefinition, user.uid);
                  }
                  if (supabaseData?.cataloguesDefinition) {
                    setCataloguesDefinition(supabaseData.cataloguesDefinition, user.uid);
                  }
                  applyUserSettingsFromCloud(supabaseData?.userSettings);
                  safeSetInStorage('hasCompletedOnboarding', true);
                } else {
                  safeSetInStorage('hasCompletedOnboarding', false);
                }

                  setShowOfflineSyncModal(false);
                setStartupPhase('done');

                if (!hasCloudData) {
                  navigate('/welcome');
                }
              }}
              className="w-full px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 disabled:bg-red-50 text-red-700 font-semibold text-sm sm:text-base transition-colors"
            >
              Delete offline data
              </button>
              </>
          </div>
        </div>
      )}

      <ToastContainer />
      <SyncStatusIndicator />
      <OfflineStatusIndicator />

      {/* Detailed sync (e.g. backup restore → cloud): same popup as offline→cloud — ring, %, status text */}
      {isSyncContextSyncing && syncStatusDetail != null && (
        <SyncProgressModal
          open
          zClassName="z-[130]"
          percent={syncContextProgressPercent}
          detail={syncStatusDetail}
          title="Syncing to cloud"
          helperText="Please keep the app open until this finishes."
        />
      )}
      {/* Routine strict-mode syncs: original full-screen Lottie */}
      {isSyncContextSyncing && syncStatusDetail == null && (
        <SyncBusyOverlay
          zClassName="z-[110]"
          title="Syncing to cloud"
          subtitle="Please wait…"
        />
      )}

      {/* Fills gap when native launch splash is gone but catalogue is not ready yet (esp. Android 12+ WebView first paint). */}
      {showCloudBootstrapOverlay && !isSyncContextSyncing && (
        <div className="fixed inset-0 z-[115] bg-white overflow-auto">
          <SplashLoadingLayout />
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
        <Suspense fallback={null}>
          <Tutorial onClose={() => setShowTutorial(false)} />
        </Suspense>
      )}

      <Suspense fallback={<RouteLoadingFallback />}>
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
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SyncProvider>
            <SubscriptionProvider>
              <GlassThemeProGate />
              <Router>
                <AppWithBackHandler />
              </Router>
            </SubscriptionProvider>
            </SyncProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
