import React, { useEffect, useLayoutEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
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
import { DEFAULT_FIELDS, getFieldsDefinition, setFieldsDefinition } from "./config/fieldConfig";
import { runMigrations, migrateUnkeyedDataToUserKeyed } from "./utils/dataMigration";
import { initializeFirebaseMessaging } from "./services/firebaseService";
import { initWebAnalyticsIfNeeded } from "./config/firebaseConfig";
import { subscribeToNewSellerOrders, startPollingForNewSellerOrders } from "./services/orderNotifications";
import { initPushTokenForLoggedInUser } from "./services/pushTokenService";
import { readProductSourceBase64ForCloudUpload } from "./utils/productSourceImage";
import { assertProductsHaveCloudImageUrlForSync } from "./utils/syncImageValidation";
import { mergeProductsData } from "./utils/productMerge";
import {
  safeGetFromStorage,
  safeSetInStorage,
  getStorageKey,
  readProductsWithLegacyFallback,
  readDeletedProductsWithLegacyFallback,
  safeSetProductsCache,
  safeSetDeletedProductsCache,
} from "./utils/safeStorage";
import { mapWithConcurrencyLimit } from "./utils/concurrencyPool";
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { useAuth } from "./context/AuthContext";
import { useSync, applyUserSettingsFromCloud, CATALOGUE_LOCAL_IMAGES_READY_EVENT } from "./context/SyncContext";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import ReconnectingStatusIndicator from "./components/ReconnectingStatusIndicator";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import { supabase } from "./supabaseClient";
/** Eager import: home shell must not depend on a lazy chunk fetch (breaks offline reload on web). */
import CatalogueApp from "./CatalogueApp";

const CreateProduct = lazy(() => import("./CreateProduct"));
const CreateBulk = lazy(() => import("./pages/CreateBulk"));
const Shelf = lazy(() => import("./Shelf"));
const Retail = lazy(() => import("./Retail"));
const Settings = lazy(() => import("./Settings"));
const AppearanceSettings = lazy(() => import("./pages/AppearanceSettings"));
const ThemesSettings = lazy(() => import("./pages/ThemesSettings"));
const WatermarkSettings = lazy(() => import("./pages/WatermarkSettings"));
const FieldsSettings = lazy(() => import("./pages/FieldsSettings"));
const CurrencySettings = lazy(() => import("./pages/CurrencySettings"));
const ManageCategories = lazy(() => import("./ManageCategories"));
const ProInfo = lazy(() => import("./pages/ProInfo"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const EmailConfirmed = lazy(() => import("./pages/EmailConfirmed"));
const Account = lazy(() => import("./pages/Account"));
const Orders = lazy(() => import("./pages/Orders"));
const Store = lazy(() => import("./pages/Store"));
const CreateOrder = lazy(() => import("./pages/CreateOrder"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const OrderForm = lazy(() => import("./pages/OrderForm"));
const ConfirmOrder = lazy(() => import("./pages/ConfirmOrder"));
const StoreView = lazy(() => import("./pages/StoreView"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy"));
const TermsOfService = lazy(() => import("./TermsOfService"));
const Website = lazy(() => import("./Website"));
const Tutorial = lazy(() => import("./Tutorial"));
const HomepageEditorPage = lazy(() => import("./pages/HomepageEditorPage"));
const StoreCustomDomain = lazy(() => import("./pages/StoreCustomDomain"));
import { ToastProvider, useToast } from "./context/ToastContext";
import { ToastContainer } from "./components/ToastContainer";
import { AuthProvider } from "./context/AuthContext";
import { NetworkStatusProvider } from "./context/NetworkStatusContext";
import { SyncProvider } from "./context/SyncContext";
import {
  cloudWriteWouldBeBlocked,
  isBrowserOnline,
  OFFLINE_CLOUD_WRITE_TOAST,
} from "./utils/cloudWritePolicy";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { authService } from "./services/authService";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import RenderingOverlay from "./RenderingOverlay";
import ErrorBoundary from "./components/ErrorBoundary";
import { saveRenderedImage } from "./Save";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { DEFAULT_CATALOGUES, getAllCatalogues, getCataloguesDefinition, setCataloguesDefinition } from "./config/catalogueConfig";
import { ThemeProvider } from "./context/ThemeContext";
import GlassThemeProGate from "./components/GlassThemeProGate";
import { SyncProgressModal } from "./components/SyncProgressModal";
import { SyncBusyOverlay } from "./components/SyncBusyOverlay";
import { resolveStoreSlugFromHostname } from "./utils/storefrontDomain";
import { isHomepageEditorPath, isOfflineBuilderMode } from "./config/offlineBuilder";

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
  const { user, loading, supabaseData, supabaseDataLoading, refreshSupabaseData, logout } = useAuth();
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
  const [offlineDeleteLoading, setOfflineDeleteLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncProgressPercent, setSyncProgressPercent] = useState(0);
  const [sessionLogoutLoading, setSessionLogoutLoading] = useState(false);
  const cloudMigrationMarkingRef = useRef<Set<string>>(new Set());
  const isGuestUser = authService.isOfflineGuest() || Boolean(user?.isAnonymous);

  useEffect(() => {
    (window as unknown as { __offlineSyncInProgress?: boolean }).__offlineSyncInProgress =
      syncNowLoading;
  }, [syncNowLoading]);

  // Startup pipeline state: gates everything until legacy offline data is resolved.
  // 'pending' = haven't checked yet, 'resolving' = popup shown / sync in progress,
  // 'done' = resolved (either synced, deleted, or no offline data).
  const [startupPhase, setStartupPhase] = useState<'pending' | 'resolving' | 'done'>('pending');
  const startupRanForUserRef = useRef<string | null>(null);
  /** Strict returning-user bootstrap runs once per login; separate from startupRanForUserRef (step 3/4). */
  const strictBootstrapRanRef = useRef<string | null>(null);
  /** Prevent repeated metadata refetch loops when initial snapshot misses definitions/settings. */
  const metadataHydrationFetchForUserRef = useRef<string | null>(null);
  /** False until first catalogue hydrate finishes. Strict path sets true once local/snapshot data is applied; cloud refresh may continue in background. */
  const [catalogueFirstLoadSettled, setCatalogueFirstLoadSettled] = useState(false);
  const [startupStatusText, setStartupStatusText] = useState('Fetching your catalogue');

  const isHomeRoute = location.pathname === '/' || location.pathname === '';
  const isEditFlowRoute = location.pathname === '/create' || location.pathname === '/create-bulk';
  const shouldDeferCloudSyncNow = () =>
    isEditFlowRoute || (typeof document !== 'undefined' && document.visibilityState !== 'visible');
  const isStoreSubdomainHost = Boolean(resolveStoreSlugFromHostname());
  const isStorefrontRootRoute = isStoreSubdomainHost && location.pathname === '/';
  const isPublicStoreOrOrderRoute =
    isStoreSubdomainHost ||
    isStorefrontRootRoute ||
    location.pathname.startsWith('/store/') ||
    location.pathname.startsWith('/o/');

  const isNative = Capacitor.getPlatform() !== "web";
  const OFFLINE_MIGRATION_PENDING_PREFIX = "offlineMigrationPending::";

  const parseJsonSafe = useCallback((raw: string | null): any | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const toCatalogueSignature = useCallback((catalogue: any) => {
    if (!catalogue || typeof catalogue !== "object") return null;
    return {
      id: String(catalogue.id ?? ""),
      label: String(catalogue.label ?? ""),
      priceField: String(catalogue.priceField ?? ""),
      priceUnitField: String(catalogue.priceUnitField ?? ""),
      stockField: String(catalogue.stockField ?? ""),
      folder: String(catalogue.folder ?? ""),
      order: Number(catalogue.order ?? 0),
      isDefault: Boolean(catalogue.isDefault),
      heroImage: String(catalogue.heroImage ?? ""),
      description: String(catalogue.description ?? ""),
    };
  }, []);

  const isMeaningfulCataloguesDefinition = useCallback((definition: any): boolean => {
    const catalogues = Array.isArray(definition?.catalogues) ? definition.catalogues : [];
    if (catalogues.length === 0) return false;
    if (catalogues.length !== DEFAULT_CATALOGUES.length) return true;

    const normalizedCurrent = catalogues
      .map((c: any) => toCatalogueSignature(c))
      .filter(Boolean)
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
    const normalizedDefault = DEFAULT_CATALOGUES
      .map((c) => toCatalogueSignature(c))
      .filter(Boolean)
      .sort((a: any, b: any) => a.id.localeCompare(b.id));

    return JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedDefault);
  }, [toCatalogueSignature]);

  const areCataloguesEquivalent = useCallback((a: any, b: any): boolean => {
    const aList = Array.isArray(a?.catalogues) ? a.catalogues : [];
    const bList = Array.isArray(b?.catalogues) ? b.catalogues : [];
    const normalize = (list: any[]) =>
      list
        .map((c: any) => toCatalogueSignature(c))
        .filter(Boolean)
        .sort((x: any, y: any) => String(x.id).localeCompare(String(y.id)));
    return JSON.stringify(normalize(aList)) === JSON.stringify(normalize(bList));
  }, [toCatalogueSignature]);

  /** Avoid stale Supabase rows (missing legacy cat2, etc.) overwriting a correct local definition. */
  const shouldApplyRemoteCataloguesOverLocal = useCallback(
    (localDef: any, remoteDef: any, hasPersistedLocal: boolean): boolean => {
      if (!remoteDef?.catalogues || !Array.isArray(remoteDef.catalogues)) return false;
      if (!hasPersistedLocal) return true;
      if (areCataloguesEquivalent(localDef, remoteDef)) return false;

      const localLu = localDef?.lastUpdated
        ? new Date(localDef.lastUpdated).getTime()
        : 0;
      const remoteLu = remoteDef?.lastUpdated
        ? new Date(remoteDef.lastUpdated).getTime()
        : 0;
      const localN = Array.isArray(localDef?.catalogues) ? localDef.catalogues.length : 0;
      const remoteN = remoteDef.catalogues.length;

      if (remoteLu > localLu) return true;

      if (remoteN < localN && remoteLu <= localLu) return false;

      if (
        remoteN > localN &&
        !isMeaningfulCataloguesDefinition(localDef) &&
        isMeaningfulCataloguesDefinition(remoteDef)
      ) {
        return true;
      }

      return false;
    },
    [areCataloguesEquivalent, isMeaningfulCataloguesDefinition]
  );

  const toFieldSignature = useCallback((field: any) => {
    if (!field || typeof field !== "object") return null;
    return {
      key: String(field.key ?? ""),
      label: String(field.label ?? ""),
      type: String(field.type ?? ""),
      enabled: field.enabled !== false,
      visible: field.visible !== false,
      unitsEnabled: field.unitsEnabled === true,
      unitField: String(field.unitField ?? ""),
      defaultUnit: String(field.defaultUnit ?? ""),
      unitOptions: Array.isArray(field.unitOptions) ? field.unitOptions.map((u: any) => String(u)) : [],
      visibility: {
        shareImage: field.visibility?.shareImage !== false,
        pdf: field.visibility?.pdf !== false,
        orderLink: field.visibility?.orderLink !== false,
        onlineStore: field.visibility?.onlineStore !== false,
      },
    };
  }, []);

  const isMeaningfulFieldsDefinition = useCallback((definition: any): boolean => {
    const fields = Array.isArray(definition?.fields) ? definition.fields : [];
    if (fields.length === 0) return false;
    if (fields.length !== DEFAULT_FIELDS.length) return true;

    const normalizedCurrent = fields
      .map((f: any) => toFieldSignature(f))
      .filter(Boolean)
      .sort((a: any, b: any) => a.key.localeCompare(b.key));
    const normalizedDefault = DEFAULT_FIELDS
      .map((f) => toFieldSignature(f))
      .filter(Boolean)
      .sort((a: any, b: any) => a.key.localeCompare(b.key));

    return JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedDefault);
  }, [toFieldSignature]);

  const markOfflineMigrationCompletedInCloud = useCallback(async (uid: string) => {
    if (!uid) return false;
    if (cloudMigrationMarkingRef.current.has(uid)) return false;
    const pendingKey = `${OFFLINE_MIGRATION_PENDING_PREFIX}${uid}`;
    cloudMigrationMarkingRef.current.add(uid);
    try {
      const { syncUserSettings } = await import("./services/supabaseSync");
      const result = await syncUserSettings(uid, {
        data: {
          offline_migration_completed: true,
          offline_migration_completed_at: new Date().toISOString(),
        },
      });
      if (!result.success) {
        console.warn("⚠️ Failed to mark offline migration completed in cloud:", result.error);
        localStorage.setItem(pendingKey, "1");
        return false;
      }
      localStorage.removeItem(pendingKey);
      return true;
    } catch (err) {
      console.warn("⚠️ Failed to mark offline migration completed in cloud:", err);
      localStorage.setItem(pendingKey, "1");
      return false;
    } finally {
      cloudMigrationMarkingRef.current.delete(uid);
    }
  }, []);

  // Retry any pending cloud migration marker write (e.g. temporary network failure).
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const pendingKey = `${OFFLINE_MIGRATION_PENDING_PREFIX}${uid}`;
    if (localStorage.getItem(pendingKey) !== "1") return;
    void markOfflineMigrationCompletedInCloud(uid);
  }, [user?.uid, markOfflineMigrationCompletedInCloud]);

  // Never re-show the native Capacitor splash (logo-only). Cold start uses a plain white window (Android styles);
  // loading UX is SplashLoadingLayout / auth UI inside the WebView.
  useEffect(() => {
    if (!isNative) {
      SplashScreen.hide().catch(() => {});
      return;
    }
    SplashScreen.hide().catch(() => {});
  }, [isNative]);

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

  // `useEffect` runs after paint, so the first frame had `products === []` and the Products tab looked empty
  // under the splash. Read keyed local storage before paint (after optional migrate) so the list matches cache immediately.
  useLayoutEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    const uid = user.uid;
    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      const p = readProductsWithLegacyFallback(uid);
      const d = readDeletedProductsWithLegacyFallback(uid);
      setProducts((prev) => (prev.length > 0 ? prev : p));
      setDeletedProducts((prev) => (prev.length > 0 ? prev : d));
      return;
    }

    // All signed-in (non-guest) users: hydrate from keyed localStorage before paint so web/PWA
    // works offline even when strict-mode flags are not set yet.
    migrateUnkeyedDataToUserKeyed(uid);
    const p = readProductsWithLegacyFallback(uid);
    const d = readDeletedProductsWithLegacyFallback(uid);

    // After startup completes we still must backfill React state when it stayed empty but
    // device cache has rows (race / strict bootstrap / missed merge). Skip when both are empty
    // so we don't fight an intentional empty catalogue.
    if (startupPhase === 'done' && p.length === 0 && d.length === 0) return;

    setProducts((prev) => (prev.length > 0 ? prev : p));
    setDeletedProducts((prev) => (prev.length > 0 ? prev : d));
  }, [loading, user?.uid, startupPhase]);

  // ──────────────────────────────────────────────────────
  // SINGLE SEQUENTIAL STARTUP PIPELINE
  // Runs once per user login. All decisions happen here in order.
  // No other useEffect touches products/deletedProducts until startupPhase === 'done'.
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) {
      setStartupPhase('pending');
      setStartupStatusText('Fetching your catalogue');
      startupRanForUserRef.current = null;
      strictBootstrapRanRef.current = null;
      metadataHydrationFetchForUserRef.current = null;
      setCatalogueFirstLoadSettled(false);
      setProducts([]);
      setDeletedProducts([]);
      return;
    }

    const userId = user.uid;

    // Website builder: do not block on Supabase profile / startup sync (localStorage saves).
    if (isHomepageEditorPath(location.pathname) && isOfflineBuilderMode()) {
      if (startupRanForUserRef.current !== userId) {
        startupRanForUserRef.current = userId;
        migrateUnkeyedDataToUserKeyed(userId);
        const localProducts = readProductsWithLegacyFallback(userId);
        const localDeleted = readDeletedProductsWithLegacyFallback(userId);
        setProducts((prev) => (prev.length > 0 ? prev : localProducts));
        setDeletedProducts((prev) => (prev.length > 0 ? prev : localDeleted));
      }
      setCatalogueFirstLoadSettled(true);
      setStartupPhase('done');
      setStartupStatusText('Ready');
      return;
    }

    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) {
      if (startupRanForUserRef.current === userId) return;
      startupRanForUserRef.current = userId;
      setStartupStatusText('Loading your local catalogue');
      // Guest users: load local data, skip everything else.
      const guestProducts = readProductsWithLegacyFallback(userId);
      const guestDeleted = readDeletedProductsWithLegacyFallback(userId);
      setProducts(guestProducts);
      setDeletedProducts(guestDeleted);
      setCatalogueFirstLoadSettled(true);
      setStartupPhase('done');
      return;
    }

    // Step 2 (early): returning strict user — do not wait on supabaseDataLoading (2s splash starts immediately).
    const strictAlreadyEnabled = localStorage.getItem('strictOnlineMode::device') === 'true';
    const legacyResolved = localStorage.getItem('offlineLegacyResolved::device') === 'true';
    const strictReturning = strictAlreadyEnabled && legacyResolved;

    if (strictReturning) {
      // Skip if normal startup (step 3/4) already ran for this user this session.
      if (startupRanForUserRef.current === userId) return;
      if (strictBootstrapRanRef.current === userId) return;
    }

    // Wipe legacy unkeyed caches from any previous user on this device.
    if (previousUserIdRef.current && previousUserIdRef.current !== userId) {
      clearLegacyUnkeyedProductCaches();
    }
    previousUserIdRef.current = userId;

    // Step 1: Run data migration (moves unkeyed localStorage to keyed).
    migrateUnkeyedDataToUserKeyed(userId);

    if (strictReturning) {
      // Returning strict-mode user: apply local cache and/or auth snapshot immediately, splash max 2s, then cloud refresh.
      const STARTUP_SPLASH_MS = 2000;
      void (async () => {
        try {
          setStartupStatusText('Fetching products from cloud');
          const localProducts = readProductsWithLegacyFallback(userId);
          const localDeleted = readDeletedProductsWithLegacyFallback(userId);
          const hasLocalCache = localProducts.length > 0 || localDeleted.length > 0;
          let sourceSnapshot = (!supabaseDataLoading && supabaseData != null)
            ? supabaseData
            : null;

          // First app open after reinstall can hit a race where strict bootstrap runs
          // before profile rows are ready. If local cache is empty, force one fresh read (online only).
          if (!sourceSnapshot && !hasLocalCache && isBrowserOnline()) {
            try {
              setStartupStatusText('Refreshing account snapshot');
              const SNAPSHOT_WAIT_MS = 12000;
              sourceSnapshot = await Promise.race([
                refreshSupabaseData({ skipLoadingIndicator: true }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_WAIT_MS)),
              ]);
            } catch {
              sourceSnapshot = null;
            }
          }

          // No snapshot and nothing on device: finish startup (empty catalogue). Never leave the
          // UI stuck on "Refreshing account snapshot" when the network lies online or hangs.
          if (!sourceSnapshot && !hasLocalCache) {
            strictBootstrapRanRef.current = userId;
            setProducts([]);
            setDeletedProducts([]);
            setCatalogueFirstLoadSettled(true);
            setStartupPhase('done');
            setStartupStatusText('Done');
            return;
          }

          strictBootstrapRanRef.current = userId;
          let useRemoteSnapshot = sourceSnapshot != null;
          // Auth sets defaultSupabaseData (empty rows) when fetch fails offline. Do not treat that
          // as authoritative over keyed localStorage — it would wipe the catalogue.
          if (useRemoteSnapshot && hasLocalCache) {
            const remoteHasProductData =
              (Array.isArray(sourceSnapshot!.products) && sourceSnapshot!.products.length > 0) ||
              (Array.isArray(sourceSnapshot!.deletedProducts) &&
                sourceSnapshot!.deletedProducts.length > 0);
            if (!remoteHasProductData) {
              useRemoteSnapshot = false;
            }
          }

          let cloudProducts: any[];
          let cloudDeleted: any[];
          let rawCats: any[];

          if (useRemoteSnapshot) {
            cloudProducts = Array.isArray(sourceSnapshot!.products) ? sourceSnapshot!.products : [];
            cloudDeleted = Array.isArray(sourceSnapshot!.deletedProducts) ? sourceSnapshot!.deletedProducts : [];
            rawCats = sourceSnapshot?.categories || [];
          } else {
            cloudProducts = localProducts;
            cloudDeleted = localDeleted;
            try {
              const keyed = localStorage.getItem(getStorageKey('categories', userId));
              const unkeyed = localStorage.getItem('categories');
              const c = JSON.parse(keyed || unkeyed || '[]');
              rawCats = Array.isArray(c) ? c : [];
            } catch {
              rawCats = [];
            }
          }

          const deletedIds = new Set(cloudDeleted.map((p: any) => p.id));
          const filteredProducts = cloudProducts.filter((p: any) => !deletedIds.has(p.id));

          setStartupStatusText('Applying products');
          setProducts(filteredProducts);
          safeSetProductsCache(userId, filteredProducts);
          setDeletedProducts(cloudDeleted);
          safeSetDeletedProductsCache(userId, cloudDeleted);

          const normalizedCats = rawCats.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
          const categoriesJson = JSON.stringify(normalizedCats);
          setStartupStatusText('Fetching categories');
          localStorage.setItem('categories', categoriesJson);
          localStorage.setItem(getStorageKey('categories', userId), categoriesJson);

          if (useRemoteSnapshot) {
            if (sourceSnapshot?.fieldsDefinition) {
              setStartupStatusText('Fetching field definitions');
              setFieldsDefinition(sourceSnapshot.fieldsDefinition, userId);
              window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
                detail: { newDefinition: sourceSnapshot.fieldsDefinition, template: sourceSnapshot.fieldsDefinition?.industry || 'Custom', isBackupRestore: false }
              }));
            }
            if (sourceSnapshot?.cataloguesDefinition) {
              setStartupStatusText('Fetching catalogue definitions');
              const localCatDef = getCataloguesDefinition(userId);
              const hasCatPersisted = Boolean(
                localStorage.getItem(getStorageKey('cataloguesDefinition', userId))
              );
              if (
                shouldApplyRemoteCataloguesOverLocal(
                  localCatDef,
                  sourceSnapshot.cataloguesDefinition,
                  hasCatPersisted
                )
              ) {
                setCataloguesDefinition(sourceSnapshot.cataloguesDefinition, userId);
                window.dispatchEvent(new CustomEvent('catalogues-changed', {
                  detail: { action: 'update', catalogues: sourceSnapshot.cataloguesDefinition.catalogues }
                }));
              }
            }
            setStartupStatusText('Fetching user settings');
            applyUserSettingsFromCloud(sourceSnapshot?.userSettings);
          } else {
            const rawFd = localStorage.getItem(getStorageKey('fieldsDefinition', userId));
            if (rawFd) {
              try {
                const localFields = JSON.parse(rawFd);
                if (localFields && Array.isArray(localFields.fields) && localFields.fields.length > 0) {
                  setFieldsDefinition(localFields, userId);
                  window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
                    detail: { newDefinition: localFields, template: localFields.industry || 'Custom', isBackupRestore: false }
                  }));
                }
              } catch {
                /* ignore */
              }
            }
            const rawCat = localStorage.getItem(getStorageKey('cataloguesDefinition', userId));
            if (rawCat) {
              try {
                const localCatalogues = JSON.parse(rawCat);
                if (localCatalogues?.catalogues?.length) {
                  setCataloguesDefinition(localCatalogues, userId);
                  window.dispatchEvent(new CustomEvent('catalogues-changed', {
                    detail: { action: 'update', catalogues: localCatalogues.catalogues }
                  }));
                }
              } catch {
                /* ignore */
              }
            }
          }

          // Allow catalogue UI immediately from local/snapshot data. Do not wait for
          // refreshFromCloud — it calls Supabase and can hang indefinitely offline.
          setCatalogueFirstLoadSettled(true);

          // No artificial splash when offline or when showing device/local data — avoids a spinner
          // after the catalogue rows are already applied.
          const splashMs =
            !isBrowserOnline() || !useRemoteSnapshot ? 0 : STARTUP_SPLASH_MS;
          window.setTimeout(() => {
            setStartupPhase('done');
          }, splashMs);

          void refreshFromCloud()
            .then(async (cloudData) => {
              setStartupStatusText('Finalizing cloud sync');
              if (cloudData) {
                setProducts(cloudData.products);
                setDeletedProducts(cloudData.deletedProducts);
              }

              // Ensure strict first-launch also hydrates metadata/settings,
              // not only products, when initial snapshot arrived late.
              if (!isBrowserOnline()) {
                setSupabaseSyncStatus('synced');
                return;
              }
              const META_REFRESH_MS = 12000;
              const latest = await Promise.race([
                refreshSupabaseData({ skipLoadingIndicator: true }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), META_REFRESH_MS)),
              ]);
              if (latest?.fieldsDefinition) {
                setStartupStatusText('Refreshing field definitions');
                setFieldsDefinition(latest.fieldsDefinition, userId);
                window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
                  detail: {
                    newDefinition: latest.fieldsDefinition,
                    template: latest.fieldsDefinition?.industry || 'Custom',
                    isBackupRestore: false,
                  },
                }));
              }
              if (latest?.cataloguesDefinition?.catalogues?.length) {
                const localCatDef = getCataloguesDefinition(userId);
                const hasCatPersisted = Boolean(
                  localStorage.getItem(getStorageKey('cataloguesDefinition', userId))
                );
                if (
                  shouldApplyRemoteCataloguesOverLocal(
                    localCatDef,
                    latest.cataloguesDefinition,
                    hasCatPersisted
                  )
                ) {
                  setStartupStatusText('Refreshing catalogue definitions');
                  setCataloguesDefinition(latest.cataloguesDefinition, userId);
                  window.dispatchEvent(new CustomEvent('catalogues-changed', {
                    detail: { action: 'update', catalogues: latest.cataloguesDefinition.catalogues },
                  }));
                }
              }
              setStartupStatusText('Refreshing user settings');
              applyUserSettingsFromCloud(latest?.userSettings);

              setSupabaseSyncStatus('synced');
            })
            .catch((e) => {
              console.warn('⚠️ refreshFromCloud failed (using auth snapshot):', e);
              setSupabaseSyncStatus('synced');
            })
            .finally(() => {
              setCatalogueFirstLoadSettled(true);
            });
        } catch (e) {
          console.error('❌ Strict startup bootstrap failed:', e);
          setStartupPhase('done');
          setCatalogueFirstLoadSettled(true);
        }
      })();
      return;
    }

    const localSnapshotP = readProductsWithLegacyFallback(userId);
    const localSnapshotD = readDeletedProductsWithLegacyFallback(userId);
    const hasDeviceCatalogueCache =
      localSnapshotP.length > 0 || localSnapshotD.length > 0;

    // Stale-while-revalidate (online): show keyed device cache immediately while the profile fetch runs.
    // Do not set startupRanForUserRef — step 4 still merges the cloud snapshot when it arrives.
    const showCachedCatalogueWhileCloudLoads = () => {
      setStartupStatusText('Showing saved catalogue');
      setProducts(localSnapshotP);
      setDeletedProducts(localSnapshotD);
      setCatalogueFirstLoadSettled(true);
      setStartupPhase('done');
    };

    // Wait for auth snapshot while online. Offline, proceed with local cache so startup does not stall.
    if (supabaseDataLoading && isBrowserOnline() && !isHomepageEditorPath(location.pathname)) {
      setStartupStatusText('Fetching products, categories and settings');
      if (hasDeviceCatalogueCache) {
        showCachedCatalogueWhileCloudLoads();
      }
      return;
    }

    // Race: `loadUserData` runs async after login. If step 4 runs while `supabaseData` is still null,
    // we skip `safeSetInStorage`, set `startupRanForUserRef`, and finish startup; when data arrives
    // the ref blocks forever and products never persist offline (Orders still save on each fetch).
    if (isBrowserOnline() && supabaseData == null) {
      if (hasDeviceCatalogueCache) {
        showCachedCatalogueWhileCloudLoads();
      }
      return;
    }

    // Only run step 3/4 once per user (strict path above does not set this ref).
    if (startupRanForUserRef.current === userId) return;
    startupRanForUserRef.current = userId;

    const cloudMigrationCompleted =
      supabaseData?.userSettings?.data?.offline_migration_completed === true;
    const hasCloudAccountData = Boolean(
      (Array.isArray(supabaseData?.products) && supabaseData.products.length > 0) ||
      (Array.isArray(supabaseData?.deletedProducts) && supabaseData.deletedProducts.length > 0) ||
      (Array.isArray(supabaseData?.categories) && supabaseData.categories.length > 0) ||
      supabaseData?.fieldsDefinition ||
      supabaseData?.cataloguesDefinition ||
      supabaseData?.userSettings
    );

    // Existing online account without migration flag: mark once and never ask again.
    if (!cloudMigrationCompleted && hasCloudAccountData) {
      void markOfflineMigrationCompletedInCloud(userId);
      localStorage.setItem('offlineLegacyResolved::device', 'true');
      localStorage.setItem('strictOnlineMode::device', 'true');
    }

    // Step 3: Check for legacy offline data (ANY type, not just products).
    const hasLegacyProducts = (() => {
      const kp = readProductsWithLegacyFallback(userId);
      return Array.isArray(kp) && kp.length > 0;
    })();
    const hasLegacyDeleted = (() => {
      const kd = readDeletedProductsWithLegacyFallback(userId);
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
    const hasLegacyFields = (() => {
      const keyed = parseJsonSafe(localStorage.getItem(getStorageKey('fieldsDefinition', userId)));
      const unkeyed = parseJsonSafe(localStorage.getItem('fieldsDefinition'));
      return isMeaningfulFieldsDefinition(keyed) || isMeaningfulFieldsDefinition(unkeyed);
    })();
    const hasLegacyCatalogues = (() => {
      const keyed = parseJsonSafe(localStorage.getItem(getStorageKey('cataloguesDefinition', userId)));
      const unkeyed = parseJsonSafe(localStorage.getItem('cataloguesDefinition'));
      return isMeaningfulCataloguesDefinition(keyed) || isMeaningfulCataloguesDefinition(unkeyed);
    })();
    const hasAnyOfflineData = hasLegacyProducts || hasLegacyDeleted || hasLegacyCategories || hasLegacyFields || hasLegacyCatalogues;

    const shouldShowOfflineSyncPrompt =
      isBrowserOnline() &&
      !supabaseDataLoading &&
      !cloudMigrationCompleted &&
      !hasCloudAccountData &&
      !legacyResolved &&
      hasAnyOfflineData;

    if (shouldShowOfflineSyncPrompt) {
      // Step 3a: Offline data found, needs resolution. Show popup and block.
      setStartupPhase('resolving');
      setShowOfflineSyncModal(true);

      // Load local data so user can see what they have while deciding.
      const localP = readProductsWithLegacyFallback(userId);
      const localD = readDeletedProductsWithLegacyFallback(userId);
      setProducts(localP);
      setDeletedProducts(localD);
      console.log('⏳ [startup] Offline data detected, awaiting user decision');
      return;
    }

    // Step 4: No offline data (or already resolved but strict not enabled yet).
    // This is a new user or a user whose legacy was already handled.
    // Apply Supabase data normally (merge for non-strict, or just load).
    const localProducts = readProductsWithLegacyFallback(userId);
    const localDeleted = readDeletedProductsWithLegacyFallback(userId);

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
      safeSetProductsCache(userId, merged);
    } else {
      setProducts(localProducts);
      safeSetProductsCache(userId, localProducts);
      }

    if (supabaseData?.deletedProducts && supabaseData.deletedProducts.length > 0) {
      const merged = mergeProductsData(localDeleted, supabaseData.deletedProducts);
        setDeletedProducts(merged);
      safeSetDeletedProductsCache(userId, merged);
    } else {
      setDeletedProducts(localDeleted);
      safeSetDeletedProductsCache(userId, localDeleted);
      }

    if (Array.isArray(supabaseData?.categories)) {
      const normalizedCats = supabaseData.categories
        .map((c: any) => (typeof c === 'string' ? c : c?.name))
        .filter(Boolean);
      const categoriesJson = JSON.stringify(normalizedCats);
      localStorage.setItem('categories', categoriesJson);
      localStorage.setItem(getStorageKey('categories', userId), categoriesJson);
    }

    if (supabaseData?.fieldsDefinition && Array.isArray(supabaseData.fieldsDefinition?.fields)) {
        setStartupStatusText('Applying field definitions');
        const localFieldsDef = getFieldsDefinition(userId);
        const remoteFieldsDef = supabaseData.fieldsDefinition;
        const hasPersistedLocalFields = Boolean(localStorage.getItem(getStorageKey('fieldsDefinition', userId)));
        const localLastUpdated = localFieldsDef?.lastUpdated ? new Date(localFieldsDef.lastUpdated).getTime() : 0;
        const remoteLastUpdated = remoteFieldsDef?.lastUpdated ? new Date(remoteFieldsDef.lastUpdated).getTime() : 0;
        if (!hasPersistedLocalFields || remoteLastUpdated > localLastUpdated) {
          setFieldsDefinition(remoteFieldsDef, userId);
          window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
          detail: { newDefinition: remoteFieldsDef, template: remoteFieldsDef?.industry || 'Custom', isBackupRestore: false }
          }));
        }
      }

    if (supabaseData?.cataloguesDefinition) {
        setStartupStatusText('Applying catalogue definitions');
        const localCataloguesDef = getCataloguesDefinition(userId);
        const remoteCataloguesDef = supabaseData.cataloguesDefinition;
        const hasPersistedLocalCatalogues = Boolean(localStorage.getItem(getStorageKey('cataloguesDefinition', userId)));
        if (
          shouldApplyRemoteCataloguesOverLocal(
            localCataloguesDef,
            remoteCataloguesDef,
            hasPersistedLocalCatalogues
          )
        ) {
          setCataloguesDefinition(remoteCataloguesDef, userId);
          window.dispatchEvent(new CustomEvent('catalogues-changed', {
          detail: { action: 'update', catalogues: remoteCataloguesDef.catalogues }
          }));
        }
      }

    setStartupStatusText('Applying user settings');
    applyUserSettingsFromCloud(supabaseData?.userSettings);

    // Enable strict mode for all authenticated users going forward.
    localStorage.setItem('strictOnlineMode::device', 'true');
    localStorage.setItem('offlineLegacyResolved::device', 'true');
      setSupabaseSyncStatus('synced');
    setCatalogueFirstLoadSettled(true);
    setStartupStatusText('Done');
    setStartupPhase('done');
    console.log('✅ [startup] Normal user startup complete');
  }, [
    loading,
    user?.uid,
    supabaseData,
    supabaseDataLoading,
    clearLegacyUnkeyedProductCaches,
    refreshFromCloud,
    parseJsonSafe,
    isMeaningfulFieldsDefinition,
    isMeaningfulCataloguesDefinition,
    areCataloguesEquivalent,
    shouldApplyRemoteCataloguesOverLocal,
    markOfflineMigrationCompletedInCloud,
    location.pathname,
  ]);

  // Ensure settings/definitions hydrate on first login even if the initial auth snapshot
  // raced and only products were available at startup time.
  useEffect(() => {
    if (loading) return;
    if (startupPhase !== 'done') return;
    if (supabaseDataLoading) return;
    if (!user?.uid) return;
    if (isGuestUser) return;

    const userId = user.uid;
    let cancelled = false;

    const applyCloudMetadata = (snapshot: any) => {
      if (!snapshot) return false;
      let applied = false;

      if (Array.isArray(snapshot?.categories)) {
        const normalizedCats = snapshot.categories
          .map((c: any) => (typeof c === 'string' ? c : c?.name))
          .filter(Boolean);
        const categoriesJson = JSON.stringify(normalizedCats);
        localStorage.setItem('categories', categoriesJson);
        localStorage.setItem(getStorageKey('categories', userId), categoriesJson);
        applied = true;
      }

      if (snapshot?.fieldsDefinition && Array.isArray(snapshot.fieldsDefinition?.fields)) {
        const localFieldsDef = getFieldsDefinition(userId);
        const remoteFieldsDef = snapshot.fieldsDefinition;
        const hasPersistedLocalFields = Boolean(localStorage.getItem(getStorageKey('fieldsDefinition', userId)));
        const localLastUpdated = localFieldsDef?.lastUpdated ? new Date(localFieldsDef.lastUpdated).getTime() : 0;
        const remoteLastUpdated = remoteFieldsDef?.lastUpdated ? new Date(remoteFieldsDef.lastUpdated).getTime() : 0;
        if (!hasPersistedLocalFields || remoteLastUpdated >= localLastUpdated) {
          setFieldsDefinition(remoteFieldsDef, userId);
          window.dispatchEvent(new CustomEvent('fieldDefinitionsChanged', {
            detail: { newDefinition: remoteFieldsDef, template: remoteFieldsDef?.industry || 'Custom', isBackupRestore: false }
          }));
          applied = true;
        }
      }

      if (snapshot?.cataloguesDefinition) {
        const localCataloguesDef = getCataloguesDefinition(userId);
        const remoteCataloguesDef = snapshot.cataloguesDefinition;
        const hasPersistedLocalCatalogues = Boolean(localStorage.getItem(getStorageKey('cataloguesDefinition', userId)));
        if (
          shouldApplyRemoteCataloguesOverLocal(
            localCataloguesDef,
            remoteCataloguesDef,
            hasPersistedLocalCatalogues
          )
        ) {
          setCataloguesDefinition(remoteCataloguesDef, userId);
          window.dispatchEvent(new CustomEvent('catalogues-changed', {
            detail: { action: 'update', catalogues: remoteCataloguesDef.catalogues }
          }));
          applied = true;
        }
      }

      if (snapshot?.userSettings) {
        applyUserSettingsFromCloud(snapshot.userSettings);
        applied = true;
      }

      return applied;
    };

    // If current snapshot already has metadata, apply immediately.
    const hasSnapshotMetadata = Boolean(
      supabaseData?.fieldsDefinition ||
      supabaseData?.cataloguesDefinition ||
      supabaseData?.userSettings
    );
    if (hasSnapshotMetadata) {
      applyCloudMetadata(supabaseData);
      return;
    }

    // Snapshot had no metadata; retry exactly once per login for this user.
    if (metadataHydrationFetchForUserRef.current === userId) return;
    metadataHydrationFetchForUserRef.current = userId;

    void (async () => {
      const latest = await refreshSupabaseData({ skipLoadingIndicator: true });
      if (cancelled || !latest) return;
      applyCloudMetadata(latest);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    startupPhase,
    supabaseDataLoading,
    supabaseData,
    user?.uid,
    isGuestUser,
    areCataloguesEquivalent,
    shouldApplyRemoteCataloguesOverLocal,
    refreshSupabaseData,
  ]);

  // Apply user settings immediately when profile snapshot updates (watermark/currency/etc.),
  // without waiting for the full startup metadata reconciliation pass.
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (isGuestUser) return;
    if (supabaseDataLoading) return;
    if (!supabaseData?.userSettings) return;
    applyUserSettingsFromCloud(supabaseData.userSettings);
  }, [loading, user?.uid, isGuestUser, supabaseDataLoading, supabaseData?.userSettings]);

  // Strict-mode: hydrate React state from local cache while Supabase profile is still loading.
  // Startup splash for returning users is capped at 2s; refreshFromCloud may still run afterward.
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

      let localProducts = readProductsWithLegacyFallback(userId);
      let localDeleted = readDeletedProductsWithLegacyFallback(userId);
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

        let completed = 0;
        const uploadedPairs = await mapWithConcurrencyLimit(
          missing,
          4,
          async (p: any) => {
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
            completed += 1;
            const span = Math.max(0, to - from);
            const pct = from + Math.round((completed / missing.length) * span);
            setSyncPhase(
              pct,
              `${prefix} (${completed}/${missing.length})${p.name ? ` · ${p.name}` : ''}`
            );
            return {
              productId: String(p.id),
              imageUrl: uploaded.url,
              imageVersion: Date.now(),
            };
          }
        );

        const uploadMap = new Map(
          uploadedPairs.map((x: any) => [String(x.productId), { url: x.imageUrl, version: x.imageVersion }])
        );
        const merged = items.map((p: any) => {
          const uploadedInfo = uploadMap.get(String(p.id));
          return uploadedInfo
            ? { ...p, imageUrl: uploadedInfo.url, imageVersion: uploadedInfo.version, image: '' }
            : p;
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
      safeSetProductsCache(userId, localProducts);

      setSyncPhase(28, 'Uploading shelf images…');
      let localDeletedUpdated = await uploadMissingImages(
        Array.isArray(localDeleted) ? localDeleted : [],
        'shelf',
        { percentFrom: 28, percentTo: 40, detailPrefix: 'Uploading shelf images' }
      );

      setSyncPhase(42, 'Reading local metadata…');
      let localCategories: any[] = [];
      try {
        const keyed = localStorage.getItem(getStorageKey('categories', userId));
        const unkeyed = localStorage.getItem('categories');
        const raw = JSON.parse(keyed || unkeyed || '[]');
        localCategories = Array.isArray(raw) ? raw : [];
      } catch { localCategories = []; }

      // Read raw local metadata first. Avoid treating bootstrap defaults as offline edits.
      const keyedCataloguesRaw = parseJsonSafe(localStorage.getItem(getStorageKey('cataloguesDefinition', userId)));
      const unkeyedCataloguesRaw = parseJsonSafe(localStorage.getItem('cataloguesDefinition'));
      const localCataloguesDefinition =
        (keyedCataloguesRaw && typeof keyedCataloguesRaw === 'object' ? keyedCataloguesRaw : null) ||
        (unkeyedCataloguesRaw && typeof unkeyedCataloguesRaw === 'object' ? unkeyedCataloguesRaw : null);

      const keyedFieldsRaw = parseJsonSafe(localStorage.getItem(getStorageKey('fieldsDefinition', userId)));
      const unkeyedFieldsRaw = parseJsonSafe(localStorage.getItem('fieldsDefinition'));
      const localFieldsDefinition =
        (keyedFieldsRaw && typeof keyedFieldsRaw === 'object' ? keyedFieldsRaw : null) ||
        (unkeyedFieldsRaw && typeof unkeyedFieldsRaw === 'object' ? unkeyedFieldsRaw : null);

      const shouldSyncCategories = Array.isArray(localCategories) && localCategories.length > 0;
      const shouldSyncCatalogues = isMeaningfulCataloguesDefinition(localCataloguesDefinition);
      const shouldSyncFields = isMeaningfulFieldsDefinition(localFieldsDefinition);

      const localShowWatermark = safeGetFromStorage('showWatermark', true);
      const localWatermarkText = safeGetFromStorage('watermarkText', 'Created using CatShare');
      const localWatermarkPosition = safeGetFromStorage('watermarkPosition', 'bottom-left');
      const localCurrency = localStorage.getItem('defaultCurrency') || 'INR';
      const localPriceUnits = safeGetFromStorage('priceFieldUnits', ['/ piece', '/ dozen', '/ set', '/ kg']);
      const localCustomCurrencies = safeGetFromStorage('customCurrencies', {});

      setSyncPhase(50, 'Checking cloud snapshot…');
      const remoteSnapshot = await fetchAllUserData(userId);
      if (!remoteSnapshot.success || !remoteSnapshot.data) {
        throw new Error(remoteSnapshot.error || 'Failed to fetch remote snapshot for merge');
      }
      const remoteData = remoteSnapshot.data;
      const remoteProducts = Array.isArray(remoteData.products) ? remoteData.products : [];
      const remoteDeleted = Array.isArray(remoteData.deletedProducts) ? remoteData.deletedProducts : [];
      const hasCloudMetadata =
        (Array.isArray(remoteData.categories) && remoteData.categories.length > 0) ||
        Boolean(remoteData.cataloguesDefinition) ||
        Boolean(remoteData.fieldsDefinition) ||
        Boolean(remoteData.userSettings);

      if (shouldSyncCategories) {
        setSyncProgress('Syncing categories...');
        const categoriesForSync = localCategories.map((cat: any) =>
          typeof cat === 'string' ? { id: cat, name: cat } : cat
        );
        const res = await syncCategories(userId, categoriesForSync);
        if (!res.success) throw new Error(res.error || 'Categories sync failed');
      }

      if (shouldSyncCatalogues) {
        setSyncProgress('Syncing catalogues...');
        const res = await syncCataloguesDefinition(userId, localCataloguesDefinition);
        if (!res.success) throw new Error(res.error || 'Catalogues definition sync failed');
      }

      if (shouldSyncFields) {
        setSyncProgress('Syncing fields...');
        const res = await syncFieldsDefinition(userId, localFieldsDefinition);
        if (!res.success) throw new Error(res.error || 'Fields definition sync failed');
      }

      const shouldSyncSettings =
        shouldSyncCategories ||
        shouldSyncCatalogues ||
        shouldSyncFields ||
        localProducts.length > 0 ||
        localDeletedUpdated.length > 0 ||
        !hasCloudMetadata;

      if (shouldSyncSettings) {
        setSyncProgress('Syncing settings...');
      }
      if (shouldSyncSettings) {
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
      }

      setSyncPhase(68, 'Merging with cloud snapshot…');
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
        blockUntilImagesCached: true,
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
      void markOfflineMigrationCompletedInCloud(userId);
      clearAllOfflineCaches();

      setSyncPhase(100, 'Done');
      setShowOfflineSyncModal(false);
      setCatalogueFirstLoadSettled(true);
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
  }, [user, clearAllOfflineCaches, refreshFromCloud, showToast, parseJsonSafe, isMeaningfulCataloguesDefinition, isMeaningfulFieldsDefinition, markOfflineMigrationCompletedInCloud]);

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
    if (supabaseDataLoading) return;

    const isGuestUser = localStorage.getItem('isOfflineGuest') === 'true';
    if (isGuestUser) return;
    if (!user?.uid) return;

    const isNewUser = !supabaseData?.fieldsDefinition;
    // getFieldsDefinition() returns in-memory defaults when nothing is stored — do not treat that as "has local fields"
    const hasPersistedFieldDefinition = Boolean(
      user.uid && localStorage.getItem(getStorageKey('fieldsDefinition', user.uid))
    );
    let hasCompletedOnboarding = Boolean(
      user.uid && safeGetFromStorage(getStorageKey('hasCompletedOnboarding', user.uid), false)
    );
    if (!hasCompletedOnboarding && user.uid && safeGetFromStorage('hasCompletedOnboarding', false) && supabaseData?.fieldsDefinition) {
      safeSetInStorage(getStorageKey('hasCompletedOnboarding', user.uid), true);
      hasCompletedOnboarding = true;
    }

    const publicPages = ['/welcome', '/login', '/register', '/forgot-password', '/reset-password', '/email-confirmed', '/privacy', '/terms', '/website', '/o/'];
    const isOnPublicPage = publicPages.some(p => location.pathname.includes(p));

    if (!(isNewUser && !hasPersistedFieldDefinition && !hasCompletedOnboarding && !isOnPublicPage)) {
      return;
    }

    // Safety net against auth/profile timing races:
    // before redirecting to Welcome, verify once from cloud snapshot.
    let cancelled = false;
    void (async () => {
      const latest = await refreshSupabaseData({ skipLoadingIndicator: true });
      if (cancelled) return;

      // If cloud refresh is uncertain/failed, do not force Welcome.
      // Staying on home is safer than misclassifying an existing user as new.
      if (!latest) {
        console.warn("⚠️ [onboarding] Skipping Welcome redirect due to unresolved cloud snapshot");
        return;
      }

      const hasCloudFields = Boolean(latest?.fieldsDefinition);
      if (hasCloudFields) {
        safeSetInStorage(getStorageKey('hasCompletedOnboarding', user.uid), true);
        return;
      }
      navigate('/welcome');
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname, loading, startupPhase, supabaseDataLoading, supabaseData?.fieldsDefinition, user?.uid, refreshSupabaseData]);

  // ──────────────────────────────────────────────────────
  // NATIVE: after fast refreshFromCloud, background image cache wrote imagePath — reload state
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const onLocalImagesReady = (e: Event) => {
      const uid = (e as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!uid || uid !== user?.uid) return;
      const freshP = readProductsWithLegacyFallback(uid);
      const freshD = readDeletedProductsWithLegacyFallback(uid);
      setProducts(freshP);
      setDeletedProducts(freshD);
    };
    window.addEventListener(CATALOGUE_LOCAL_IMAGES_READY_EVENT, onLocalImagesReady);
    return () => window.removeEventListener(CATALOGUE_LOCAL_IMAGES_READY_EVENT, onLocalImagesReady);
  }, [user?.uid]);

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

      const freshProducts = readProductsWithLegacyFallback(user.uid);
      const freshDeleted = readDeletedProductsWithLegacyFallback(user.uid);

      const detail = (e as CustomEvent<{ onlyProductId?: string; onlyProductIds?: string[] }> | undefined)
        ?.detail;
      const partialIds =
        detail?.onlyProductIds?.filter((id) => id != null && String(id).length > 0).map(String) ??
        (detail?.onlyProductId != null ? [String(detail.onlyProductId)] : undefined);
      const partialSyncOpts =
        partialIds && partialIds.length > 0 ? { onlyProductIds: partialIds } : undefined;
      const forceCloudSync =
        (e as CustomEvent<{ forceCloudSync?: boolean }> | undefined)?.detail?.forceCloudSync ===
        true;

      setProducts(freshProducts);
      setDeletedProducts(freshDeleted);

      // Saves still run on /create — never skip upload for an explicit save (forceCloudSync).
      if (shouldDeferCloudSyncNow() && !forceCloudSync) {
        return;
      }

      if (cloudWriteWouldBeBlocked(user, isBrowserOnline())) {
        showToast(OFFLINE_CLOUD_WRITE_TOAST, 'error');
        return;
      }

      try {
        const cloudData = await syncProductsToCloud(freshProducts, freshDeleted, {
          ...partialSyncOpts,
          skipFullCloudRefresh: true,
          maxSyncUiMs: 12000,
        });
        setProducts(cloudData.products);
        setDeletedProducts(cloudData.deletedProducts);
      } catch (err: any) {
        console.error('❌ Sync after product-added failed:', err?.message);
        showToast(
          err?.message || 'Saved on device but cloud sync failed. Try again when online.',
          'error'
        );
      }
    };
    window.addEventListener("product-added", handleNewProduct);
    return () => window.removeEventListener("product-added", handleNewProduct);
  }, [user, syncProductsToCloud, showToast, isEditFlowRoute]);

  // ──────────────────────────────────────────────────────
  // STRICT REFRESH EVENT: child components dispatch this after
  // their own awaited sync (definitions, settings, etc.)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleStrictRefresh = async () => {
      if (!isStrictMode()) return;
      if (!user?.uid) return;
      if (shouldDeferCloudSyncNow()) return;
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
  }, [refreshFromCloud, isStrictMode, user?.uid, isEditFlowRoute]);

  // ──────────────────────────────────────────────────────
  // SYNC TO SUPABASE EVENT: triggered when products are moved to shelf,
  // stock toggled, or other mutations that need syncing
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleSyncToSupabase = async (e: any) => {
      console.log('📤 sync-to-supabase event fired', {
        userId: user?.uid,
        detail: e.detail,
        strict: isStrictMode()
      });

      if (!user?.uid) {
        console.warn('⚠️ sync-to-supabase: no user ID');
        return;
      }

      if (shouldDeferCloudSyncNow()) {
        const freshProducts = e.detail?.products ?? readProductsWithLegacyFallback(user.uid);
        const freshDeleted = e.detail?.deletedProducts ?? readDeletedProductsWithLegacyFallback(user.uid);
        setProducts(freshProducts);
        setDeletedProducts(freshDeleted);
        return;
      }

      if (cloudWriteWouldBeBlocked(user, isBrowserOnline())) {
        showToast(OFFLINE_CLOUD_WRITE_TOAST, 'error');
        return;
      }

      try {
        // Use data from event detail (passed from CatalogueApp) or fall back to localStorage
        const freshProducts = e.detail?.products ?? readProductsWithLegacyFallback(user.uid);
        const freshDeleted = e.detail?.deletedProducts ?? readDeletedProductsWithLegacyFallback(user.uid);

        const cloudData = await syncProductsToCloud(freshProducts, freshDeleted, {
          skipFullCloudRefresh: true,
          fullListForPosition: freshProducts,
          maxSyncUiMs: 1000,
        });
        setProducts(cloudData.products);
        setDeletedProducts(cloudData.deletedProducts);
      } catch (e) {
        console.error('❌ sync-to-supabase failed:', e);
      }
    };
    window.addEventListener('sync-to-supabase', handleSyncToSupabase as any);
    return () => window.removeEventListener('sync-to-supabase', handleSyncToSupabase as any);
  }, [user?.uid, syncProductsToCloud, refreshFromCloud, isStrictMode, isEditFlowRoute]);

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
    // Prevent startup/auth races from overwriting a valid keyed cache with [].
    // Legit empty saves still happen after startup settles (startupPhase === 'done').
    if (cleanedProducts.length === 0 && startupPhase !== 'done') {
      const existing = readProductsWithLegacyFallback(user.uid);
      if (existing.length > 0) return;
    }
    safeSetProductsCache(user.uid, cleanedProducts);
  }, [products, user?.uid, startupPhase]);

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
    if (cleanedDeleted.length === 0 && startupPhase !== 'done') {
      const existing = readDeletedProductsWithLegacyFallback(user.uid);
      if (existing.length > 0) return;
    }
    safeSetDeletedProductsCache(user.uid, cleanedDeleted);
  }, [deletedProducts, user?.uid, startupPhase]);

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
    if (isPublicStoreOrOrderRoute) return;

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
  }, [isPublicStoreOrOrderRoute]);

  // Enable web analytics only for signed-in seller usage (exclude public store/order visitors).
  useEffect(() => {
    if (isNative) return;
    if (isPublicStoreOrOrderRoute) return;
    if (loading) return;
    if (!user?.uid || user.isAnonymous) return;
    if (authService.isOfflineGuest()) return;
    initWebAnalyticsIfNeeded();
  }, [isNative, isPublicStoreOrOrderRoute, loading, user?.uid, user?.isAnonymous]);

  // New orders: Realtime (if enabled) + REST polling (reliable when Realtime/RLS misses events)
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (authService.isOfflineGuest()) return;
    if (user.isAnonymous) return;

    let cancelled = false;
    let removeRealtime: (() => void) | undefined;
    let removePoll: (() => void) | undefined;

    removePoll = startPollingForNewSellerOrders(user.uid);

    void (async () => {
      const remove = await subscribeToNewSellerOrders(user.uid);
      if (cancelled) {
        remove();
      } else {
        removeRealtime = remove;
      }
    })();

    return () => {
      cancelled = true;
      removePoll?.();
      removeRealtime?.();
    };
  }, [loading, user?.uid, user?.isAnonymous]);

  // Register FCM token for new-order push as soon as the seller is signed in (native only).
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (user.isAnonymous) return;
    if (authService.isOfflineGuest()) return;
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let cleanupPush: (() => void) | undefined;

    scheduleIdleTask(() => {
      void (async () => {
        const cleanup = await initPushTokenForLoggedInUser(user.uid);
        if (cancelled) {
          await cleanup();
        } else {
          cleanupPush = cleanup;
        }
      })();
    });

    return () => {
      cancelled = true;
      void cleanupPush?.();
    };
  }, [loading, user?.uid, user?.isAnonymous]);

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
      } else if (location.pathname === "/catalogues") {
        // CatalogueApp registers its own backButton listener and uses window.history.back()
        // for selection mode + catalogue exit. Do not navigate(-1) here — that ran as a
        // second back on mobile and skipped clearing selection / required two gestures.
        return;
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
                disabled={syncNowLoading || offlineDeleteLoading}
                onClick={() => syncOfflineDataNow()}
                className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold text-sm sm:text-base transition-colors"
              >
                {syncNowLoading ? 'Syncing...' : 'Sync to my account'}
              </button>
            </div>

            <div className="border-t border-gray-200 my-4"></div>

              <button
                disabled={syncNowLoading || offlineDeleteLoading}
              onClick={async () => {
                const ok = window.confirm("Delete offline data permanently? This cannot be undone.");
                if (!ok) return;

                setOfflineDeleteLoading(true);
                try {
                setProducts([]);
                setDeletedProducts([]);
                safeSetProductsCache(user.uid, []);
                safeSetDeletedProductsCache(user.uid, []);

                localStorage.setItem('offlineLegacyResolved::device', 'true');
                localStorage.setItem('strictOnlineMode::device', 'true');
                void markOfflineMigrationCompletedInCloud(user.uid);
                clearAllOfflineCaches();
                clearLegacyUnkeyedProductCaches();

                localStorage.removeItem('categories');
                localStorage.removeItem('cataloguesDefinition');
                localStorage.removeItem('fieldsDefinition');
                localStorage.removeItem(getStorageKey('categories', user.uid));
                localStorage.removeItem(getStorageKey('cataloguesDefinition', user.uid));
                localStorage.removeItem(getStorageKey('fieldsDefinition', user.uid));
                localStorage.removeItem('showTutorialOnInit');

                // Fresh fetch — stale/empty supabaseData from fast splash can wrongly send returning users to Welcome.
                const freshSnapshot = await refreshSupabaseData({ skipLoadingIndicator: true });
                const cloud = freshSnapshot ?? supabaseData;

                const hasCloudData = !!(
                  cloud?.fieldsDefinition ||
                  (cloud?.products && cloud.products.length > 0) ||
                  cloud?.cataloguesDefinition
                );

                if (hasCloudData) {
                  // User already set up on another device — load from cloud, skip welcome.
                  const cloudProducts = Array.isArray(cloud?.products) ? cloud!.products : [];
                  const cloudDeleted = Array.isArray(cloud?.deletedProducts) ? cloud!.deletedProducts : [];
                  const deletedIds = new Set(cloudDeleted.map((p: any) => p.id));
                  const filteredProducts = cloudProducts.filter((p: any) => !deletedIds.has(p.id));
                  setProducts(filteredProducts);
                  setDeletedProducts(cloudDeleted);
                  safeSetProductsCache(user.uid, filteredProducts);
                  safeSetDeletedProductsCache(user.uid, cloudDeleted);

                  const rawCats = cloud?.categories || [];
                  const normalizedCats = rawCats.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
                  localStorage.setItem('categories', JSON.stringify(normalizedCats));

                  if (cloud?.fieldsDefinition) {
                    setFieldsDefinition(cloud.fieldsDefinition, user.uid);
                  }
                  if (cloud?.cataloguesDefinition) {
                    setCataloguesDefinition(cloud.cataloguesDefinition, user.uid);
                  }
                  applyUserSettingsFromCloud(cloud?.userSettings);
                  safeSetInStorage(getStorageKey('hasCompletedOnboarding', user.uid), true);
                } else {
                  safeSetInStorage(getStorageKey('hasCompletedOnboarding', user.uid), false);
                }

                  setShowOfflineSyncModal(false);
                setCatalogueFirstLoadSettled(true);
                setStartupPhase('done');

                if (!hasCloudData) {
                  navigate('/welcome');
                }
                } finally {
                  setOfflineDeleteLoading(false);
                }
              }}
              className={`w-full px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 disabled:bg-red-50 text-red-700 font-semibold text-sm sm:text-base transition-colors flex items-center justify-center min-h-[48px] ${offlineDeleteLoading ? 'cursor-wait' : ''}`}
            >
              {offlineDeleteLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="h-4 w-4 border-2 border-red-200 border-t-red-700 rounded-full animate-spin shrink-0"
                    aria-hidden
                  />
                  Checking account…
                </span>
              ) : (
                'Delete offline data'
              )}
              </button>
              </>
          </div>
        </div>
      )}

      <ToastContainer />
      <SyncStatusIndicator />
      <OfflineStatusIndicator />
      <ReconnectingStatusIndicator />

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

      {/* Auth invalid: refresh token revoked — re-login required (not slow network) */}
      {user?.sessionExpired === true && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4 py-6" role="dialog" aria-label="Sign in required">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sm:p-7">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <FiAlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Sign-in required</h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              Your sign-in is no longer valid on this device. Please log in again to sync changes to the cloud.
            </p>
            <button
              type="button"
              disabled={sessionLogoutLoading}
              onClick={async () => {
                setSessionLogoutLoading(true);
                try {
                  await logout();
                  showToast('Please log in again to continue', 'success');
                  navigate('/login', { replace: true });
                } catch {
                  showToast('Unable to log out. Please try again.', 'error');
                } finally {
                  setSessionLogoutLoading(false);
                }
              }}
              className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold text-sm transition-colors"
            >
              {sessionLogoutLoading ? 'Logging out…' : 'Log out and re-login'}
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
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/email-confirmed" element={<EmailConfirmed />} />

        {/* Public Routes */}
        <Route path="/o/:token" element={<OrderForm />} />
        <Route path="/o/:token/confirm" element={<ConfirmOrder />} />
        <Route path="/store/:slug/*" element={<StoreView />} />
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
                startupPhase={startupPhase}
                catalogueFirstLoadSettled={catalogueFirstLoadSettled}
                startupStatusText={startupStatusText}
              />
            </ProtectedRoute>
          }
        >
          {/* Leaf routes must have an element or RR warns; Catalogue UI lives outside <Outlet />. */}
          <Route index element={<></>} />
          <Route path="catalogues" element={<></>} />
        </Route>
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreateProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-bulk"
          element={
            <ProtectedRoute>
              <CreateBulk />
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
          path="/manage-categories"
          element={
            <ProtectedRoute>
              <ManageCategories />
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
        <Route
          path="/store"
          element={
            <ProtectedRoute>
              <Store />
            </ProtectedRoute>
          }
        />
        <Route
          path="/store/homepage"
          element={
            <ProtectedRoute>
              <HomepageEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/store/custom-domain"
          element={
            <ProtectedRoute>
              <StoreCustomDomain />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-order"
          element={
            <ProtectedRoute>
              <CreateOrder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetail />
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
            <NetworkStatusProvider>
            <SyncProvider>
            <SubscriptionProvider>
              <GlassThemeProGate />
              <Router>
                <AppWithBackHandler />
              </Router>
            </SubscriptionProvider>
            </SyncProvider>
            </NetworkStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
