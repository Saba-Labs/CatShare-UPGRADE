import React, { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useSearchParams, useLocation, Outlet } from "react-router-dom";
import { flushSync } from "react-dom";
import { FiPlus, FiSearch, FiTrash2, FiEdit, FiMenu, FiMessageSquare, FiList, FiImage } from "react-icons/fi";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SideDrawer from "./SideDrawer";
import CatalogueView from "./CatalogueView";
import CataloguesList from "./CataloguesList";
import ManageCatalogues from "./ManageCatalogues";
import ProductPreviewModal from "./ProductPreviewModal";
import EmptyStateIntro from "./EmptyStateIntro";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { MdInventory2 } from "react-icons/md";
import { saveRenderedImage, deleteRenderedImageForProduct } from "./Save";
import { getAllCatalogues, type Catalogue } from "./config/catalogueConfig";
import RatingModal from "./components/RatingModal";
import MainAppBottomNav from "./components/MainAppBottomNav";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import { useSync } from "./context/SyncContext";
import { safeGetFromStorage, getStorageKey } from "./utils/safeStorage";
import {
  tryReadProductSourceAsDataUrl,
  deleteProductSourceImagesBestEffort,
} from "./utils/productSourceImage";
import { HIDDEN_MENU_UNLOCKED_EVENT } from "./utils/hiddenMenuFeatures";
import { productImageDisplayUrl, parseImageVersionFromUrl } from "./utils/imageUrl";
import Lottie from "lottie-react";
import syncAnimationData from "./loading.json";

const PRODUCT_SCROLL_KEY = "productScroll";

const fabDialSpring = { type: "spring" as const, stiffness: 460, damping: 26, mass: 0.85 };

/** Products tab speed-dial: stagger by index (0 = nearer main FAB). */
const fabDialItem = {
  hidden: { opacity: 0, y: 24, scale: 0.84, rotate: -6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    rotate: 0,
    transition: { ...fabDialSpring, delay: i * 0.08 },
  }),
  leave: (i: number) => ({
    opacity: 0,
    y: 12,
    scale: 0.9,
    rotate: 4,
    transition: { duration: 0.17, ease: [0.4, 0, 1, 1] as const, delay: (1 - i) * 0.052 },
  }),
};

/** Read exact scroll: prefer main (the real list scroller); fallback to window if needed. */
function readProductsListScrollY(scrollEl: HTMLElement | null): number {
  if (scrollEl) {
    const st = scrollEl.scrollTop;
    if (st > 0 || scrollEl.scrollHeight > scrollEl.clientHeight + 1) {
      return st;
    }
  }
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function persistProductsListScrollForEdit(scrollEl: HTMLElement | null) {
  const y = readProductsListScrollY(scrollEl);
  localStorage.setItem(PRODUCT_SCROLL_KEY, String(y));
}

declare global {
  interface Window {
    __catalogueAppState?: {
      showTutorial: boolean;
      setShowTutorial: React.Dispatch<React.SetStateAction<boolean>>;
    };
    __sideDrawerState?: any;
  }
}

export function openPreviewHtml(id, tab = null) {
  const evt = new CustomEvent("open-preview", { detail: { id, tab } });
  window.dispatchEvent(evt);
}

/** Indices are for the list before the move (@hello-pangea/dnd / react-beautiful-dnd semantics). */
function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

/** Apply a reordered visible subset onto the full products array (supports search/filter). */
function applyVisibleOrderToProducts(products: any[], visibleBefore: any[], visibleAfter: any[]): any[] {
  const queue = [...visibleAfter];
  const visSet = new Set(visibleBefore.map((p) => p.id));
  return products.map((p) => {
    if (!visSet.has(p.id)) return p;
    return queue.shift() ?? p;
  });
}

export default function CatalogueApp({ products, setProducts, deletedProducts, setDeletedProducts, darkMode, setDarkMode, isRendering: propIsRendering, setIsRendering: propSetIsRendering, renderProgress: propRenderProgress, setRenderProgress: propSetRenderProgress, renderingTotal: propRenderingTotal, setRenderingTotal: propSetRenderingTotal, renderResult: propRenderResult, setRenderResult: propSetRenderResult, showTutorial, setShowTutorial, startupPhase = 'done', catalogueFirstLoadSettled = true }: { products: any[]; setProducts: React.Dispatch<React.SetStateAction<any[]>>; deletedProducts: any[]; setDeletedProducts: React.Dispatch<React.SetStateAction<any[]>>; darkMode: boolean; setDarkMode: React.Dispatch<React.SetStateAction<boolean>>; isRendering?: boolean; setIsRendering?: React.Dispatch<React.SetStateAction<boolean>>; renderProgress?: number; setRenderProgress?: React.Dispatch<React.SetStateAction<number>>; renderingTotal?: number; setRenderingTotal?: React.Dispatch<React.SetStateAction<number>>; renderResult?: any; setRenderResult?: React.Dispatch<React.SetStateAction<any>>; showTutorial?: boolean; setShowTutorial?: React.Dispatch<React.SetStateAction<boolean>>; startupPhase?: 'pending' | 'resolving' | 'done'; /** After first load path finished (incl. strict cloud refresh); empty list may show intro */ catalogueFirstLoadSettled?: boolean }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { syncProductsToCloud, isStrictMode } = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pathname = location.pathname;
  const tab = pathname === "/catalogues" ? "catalogues" : "products";
  const scrollRef = useRef(null);
  const isNative = Capacitor.getPlatform() !== "web";

  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [selectedCatalogueInCataloguesTab, setSelectedCatalogueInCataloguesTab] = useState<string | null>(null);
  const [showManageCatalogues, setShowManageCatalogues] = useState(false);
  const [renamingCatalogueIds, setRenamingCatalogueIds] = useState<Set<string>>(new Set());
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [productCountForRating, setProductCountForRating] = useState(0);

  // Listen for catalogue rename events
  useEffect(() => {
    const handleRenameStart = (e: any) => {
      const { id } = e.detail;
      setRenamingCatalogueIds((prev) => new Set(prev).add(id));
    };
    const handleRenameEnd = (e: any) => {
      const { id } = e.detail;
      setRenamingCatalogueIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };

    window.addEventListener("catalogue-rename-start", handleRenameStart);
    window.addEventListener("catalogue-rename-end", handleRenameEnd);
    return () => {
      window.removeEventListener("catalogue-rename-start", handleRenameStart);
      window.removeEventListener("catalogue-rename-end", handleRenameEnd);
    };
  }, []);

  // Initialize catalogues on component mount
  useEffect(() => {
    const cats = getAllCatalogues();
    setCatalogues(cats);
  }, []);

  // Listen for catalogue changes (e.g., after restore or when ManageCatalogues updates)
  useEffect(() => {
    const handleCataloguesChanged = () => {
      const cats = getAllCatalogues();
      setCatalogues(cats);
      console.log("✅ Catalogues refreshed from event");
    };

    window.addEventListener("catalogues-changed", handleCataloguesChanged);
    return () => window.removeEventListener("catalogues-changed", handleCataloguesChanged);
  }, []);

  // Legacy ?tab=catalogues&catalogue= → /catalogues?catalogue=
  useEffect(() => {
    const catalogueParam = searchParams.get("catalogue");
    const tabParam = searchParams.get("tab");

    if (tabParam === "catalogues" && catalogueParam) {
      navigate(`/catalogues?catalogue=${encodeURIComponent(catalogueParam)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // /catalogues?catalogue=id — open that catalogue; bare /catalogues — list
  useEffect(() => {
    if (pathname !== "/catalogues") return;
    const catalogueParam = searchParams.get("catalogue");
    setSelectedCatalogueInCataloguesTab(catalogueParam || null);
  }, [pathname, searchParams]);

  // Handle rating modal query parameters - when returning from create product page
  useEffect(() => {
    const showRatingParam = searchParams.get("showRating");
    const productCountParam = searchParams.get("productCount");

    if (showRatingParam === "true" && productCountParam) {
      setShowRatingModal(true);
      setProductCountForRating(parseInt(productCountParam, 10));

      const cat = searchParams.get("catalogue");
      const baseUrl = cat ? `/catalogues?catalogue=${encodeURIComponent(cat)}` : "/";
      navigate(baseUrl, { replace: true });
    }
  }, [searchParams, navigate]);

  // Restore scroll position when a catalogue is displayed
  useEffect(() => {
    if (selectedCatalogueInCataloguesTab && tab === "catalogues") {
      const savedY = localStorage.getItem(`catalogueScroll-${selectedCatalogueInCataloguesTab}`);
      if (savedY && scrollRef.current) {
        // Use a timeout to ensure the DOM has fully rendered
        const timeout = setTimeout(() => {
          scrollRef.current.scrollTop = parseInt(savedY, 10);
          localStorage.removeItem(`catalogueScroll-${selectedCatalogueInCataloguesTab}`);
        }, 150);
        return () => clearTimeout(timeout);
      }
    }
  }, [selectedCatalogueInCataloguesTab, tab]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Products tab: speed-dial open state (+ → single vs bulk create) */
  const [productFabExpanded, setProductFabExpanded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewList, setPreviewList] = useState([]);
  const [imageMap, setImageMap] = useState({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [showShelfConfirm, setShowShelfConfirm] = useState(false);
  const [shelfTarget, setShelfTarget] = useState(null);
  const [showHiddenDangerShelfActions, setShowHiddenDangerShelfActions] = useState(false);

  const stableImageVersionFromUrl = (url: string) => {
    const s = String(url || "").trim();
    if (!s) return 0;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  };

  // One-time migration for older products:
  // - assign deterministic imageVersion for existing imageUrl rows
  // - clear stale inline image payload when cloud URL exists
  useEffect(() => {
    if (!Array.isArray(products) || products.length === 0) return;
    let changed = false;
    const migrated = products.map((p: any) => {
      if (!p || typeof p !== "object") return p;
      const hasCloudUrl = typeof p.imageUrl === "string" && p.imageUrl.trim().length > 0;
      if (!hasCloudUrl) return p;

      const needsVersion = !(Number(p.imageVersion) > 0);
      const hasStaleInlineImage = typeof p.image === "string" && p.image.length > 0;
      if (!needsVersion && !hasStaleInlineImage) return p;

      changed = true;
      const fromQuery = parseImageVersionFromUrl(p.imageUrl);
      return {
        ...p,
        imageVersion: needsVersion ? (fromQuery ?? stableImageVersionFromUrl(p.imageUrl)) : p.imageVersion,
        image: "",
      };
    });

    if (!changed) return;
    setProducts(migrated);
    try {
      const uid = user?.uid;
      const key = uid ? getStorageKey("products", uid) : "products";
      localStorage.setItem(key, JSON.stringify(migrated));
    } catch {
      /* ignore */
    }
  }, [products, setProducts, user?.uid]);

  useEffect(() => {
    const onUnlocked = () => setShowHiddenDangerShelfActions(true);
    window.addEventListener(HIDDEN_MENU_UNLOCKED_EVENT, onUnlocked);
    return () => window.removeEventListener(HIDDEN_MENU_UNLOCKED_EVENT, onUnlocked);
  }, []);

  const [confirmToggleStock, setConfirmToggleStock] = useState(null);
  const [bypassChecked, setBypassChecked] = useState(false);
  const [localIsRendering, setLocalIsRendering] = useState(false);
  const [localRenderProgress, setLocalRenderProgress] = useState(0);
  const [localRenderResult, setLocalRenderResult] = useState(null);

  // Use passed props if available, otherwise use local state
  const isRendering = propIsRendering !== undefined ? propIsRendering : localIsRendering;
  const setIsRendering = propSetIsRendering || setLocalIsRendering;
  const renderProgress = propRenderProgress !== undefined ? propRenderProgress : localRenderProgress;
  const setRenderProgress = propSetRenderProgress || setLocalRenderProgress;
  const renderResult = propRenderResult !== undefined ? propRenderResult : localRenderResult;
  const setRenderResult = propSetRenderResult || setLocalRenderResult;

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const toggleSort = () => setShowSortMenu((prev) => !prev);
    window.addEventListener("toggle-sort", toggleSort);
    return () => window.removeEventListener("toggle-sort", toggleSort);
  }, []);


  const handleSort = (type) => {
    setSortBy(type);
    setShowSortMenu(false);
  };

  // Auto-show tutorial for new users after onboarding
  useEffect(() => {
    const shouldShowTutorial = localStorage.getItem('showTutorialOnInit');
    if (shouldShowTutorial) {
      setShowTutorial(true);
      localStorage.removeItem('showTutorialOnInit');
    }
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      const map = {};
      const batchSize = 8; // Load 8 images at a time to avoid memory spikes

      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        // Load this batch in parallel
        const promises = batch.map(async (p) => {
          // Prefer on-device source (just saved / not yet replaced in cloud) over CDN URL
          const resolved = await tryReadProductSourceAsDataUrl(p);
          if (resolved && resolved.startsWith("data:")) {
            map[p.id] = resolved;
            return;
          }

          if (p.imageUrl && typeof p.imageUrl === "string" && p.imageUrl.trim()) {
            map[p.id] = productImageDisplayUrl(p.imageUrl, p.imageVersion);
            return;
          }

          if (resolved) {
            map[p.id] = resolved;
            return;
          }

          map[p.id] = (typeof p.image === "string" && p.image ? p.image : "") || "";
        });

        // Wait for batch to complete before loading next batch
        await Promise.all(promises);

        // Update state incrementally so UI renders as images load
        setImageMap(prev => ({ ...prev, ...map }));
      }
    };
    // Clear old imageMap when products change to avoid stale cache
    setImageMap({});
    loadImages();
  }, [products]);

  useEffect(() => {
    const openMenu = () => setMenuOpen(true);
    const toggleSearch = () => setShowSearch((prev) => !prev);

    window.addEventListener("toggle-menu", openMenu);
    window.addEventListener("toggle-search", toggleSearch);

    return () => {
      window.removeEventListener("toggle-menu", openMenu);
      window.removeEventListener("toggle-search", toggleSearch);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { id, tab, filtered } = e.detail || {};
      const list = filtered || products;
      const match = list.find((p) => p.id === id);
      if (match) {
        // Only set tab if it's a valid tab value (products or catalogues)
        // Ignore catalogue IDs passed from within catalogue views
        if (tab === "catalogues") {
          navigate("/catalogues");
        } else if (tab === "products") {
          navigate("/");
        }
        setPreviewList(list);
        setPreviewProduct(match);
      }
    };
    window.addEventListener("open-preview", handler);
    return () => window.removeEventListener("open-preview", handler);
  }, [products, navigate]);

  useEffect(() => {
    const handleEditProduct = (e) => {
      const { id, catalogueId, fromCatalogue } = e.detail || {};
      if (id) {
        persistProductsListScrollForEdit(scrollRef.current);
        let url = `/create?id=${id}`;
        if (catalogueId) url += `&catalogue=${catalogueId}`;
        if (fromCatalogue) url += `&from=${fromCatalogue}`;
        navigate(url);
      }
    };
    window.addEventListener("edit-product", handleEditProduct);
    return () => window.removeEventListener("edit-product", handleEditProduct);
  }, [navigate, scrollRef]);

  useEffect(() => {
    const handleNewProduct = async () => {
      const uid = user?.uid;
      const updatedRaw = uid
        ? safeGetFromStorage(getStorageKey("products", uid), [])
        : JSON.parse(localStorage.getItem("products") || "[]");
      const updated = Array.isArray(updatedRaw)
        ? updatedRaw.map((p: any) => {
            // If cloud URL exists, stale in-object data URLs should never override it.
            if (p && typeof p === "object" && typeof p.imageUrl === "string" && p.imageUrl.trim()) {
              const cloned = { ...p };
              delete cloned.image;
              return cloned;
            }
            return p;
          })
        : [];
      setProducts(updated);

      // Clear outdated imageMap entries to prevent displaying old cached images
      // This ensures products with updated imageUrl will fetch from the new cloud URL
      setImageMap((prev) => {
        const newMap = { ...prev };
        // Remove entries for products that might have been updated with new cloud URLs
        for (const p of updated) {
          // If product has a cloud imageUrl, remove local cache to force fetch from cloud
          if (p.imageUrl) {
            delete newMap[p.id];
          }
        }
        return newMap;
      });

      // Force reload thumbnails from local filesystem immediately
      // so the new image shows without waiting for R2 upload
      for (const p of updated) {
        const thumb = await tryReadProductSourceAsDataUrl(p);
        if (thumb) {
          setImageMap((prev) => ({ ...prev, [p.id]: thumb }));
        }
      }
    };
  
    window.addEventListener("product-added", handleNewProduct);
    return () => window.removeEventListener("product-added", handleNewProduct);
  }, []);

  useEffect(() => {
    sessionStorage.removeItem("bypassStockWarningUntil");
  }, []);

  // Handle back button for catalogue navigation
  useEffect(() => {
    let removeListener: any;
    CapacitorApp.addListener("backButton", () => {
      if ((window as unknown as { __offlineSyncInProgress?: boolean }).__offlineSyncInProgress) {
        return;
      }
      // If currently rendering, minimize app instead of navigating
      if (isRendering) {
        CapacitorApp.minimizeApp();
        return;
      }

      // 1. Check for any open modals from SideDrawer or CatalogueApp
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

      // Check CatalogueApp modals
      if (catalogueAppState?.showTutorial) {
        catalogueAppState.setShowTutorial(false);
        return;
      }

      // 2. Check for open preview modals or full-screen images
      const fullScreenImageOpen = document.querySelector('[data-fullscreen-image="true"]');
      const previewModalOpen = document.querySelector(".backdrop-blur-xl.z-50");
      if (fullScreenImageOpen || previewModalOpen) {
        window.dispatchEvent(new CustomEvent("close-preview"));
        return;
      }

      // 3. If inside a catalogue view, let history management handle it (deselect or exit)
      if (tab === "catalogues" && selectedCatalogueInCataloguesTab) {
        window.history.back();
        return;
      }

      // 4. If on catalogues tab (list or same section), go to previous screen in history (e.g. another tab)
      if (tab === "catalogues") {
        navigate(-1);
        return;
      }

      // 5. If on products tab and no preview open, let App.tsx handle exit
      // Dispatch custom event so App.tsx can handle it properly
      window.dispatchEvent(new CustomEvent("catalogue-app-back-not-handled"));
    }).then((listener) => {
      removeListener = listener.remove;
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, [tab, selectedCatalogueInCataloguesTab, isRendering, navigate]);

  const handleTabChange = (key: "products" | "catalogues") => {
    if (key === "catalogues") {
      navigate("/catalogues");
    } else {
      navigate("/");
    }
    setSelected([]);
    setSearch("");
    if (key === "catalogues") {
      setSelectedCatalogueInCataloguesTab(null);
    }
  };

  const toggleStock = async (id, field) => {
    const label = field === "wholesaleStock" ? "Catalogue 1 Stock" : "Catalogue 2 Stock";
    const confirm = window.confirm(`Do you want to update ${label} for this item?`);
    if (!confirm) return;

    await Haptics.impact({ style: ImpactStyle.Medium });

    const freshProducts = products.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p));
    setProducts(freshProducts);

    if (isStrictMode() && user?.uid) {
      syncProductsToCloud(freshProducts, deletedProducts).then(cloudData => {
        setProducts(cloudData.products);
        setDeletedProducts(cloudData.deletedProducts);
      }).catch(err => console.error('Strict sync failed:', err));
    }
  };

  const handleStockToggleRequest = (id, field) => {
    const bypassUntil = parseInt(sessionStorage.getItem("bypassStockWarningUntil") || "0", 10);
    const now = Date.now();

    if (now < bypassUntil) {
      // Bypassed within 5 minutes
      Haptics.impact({ style: ImpactStyle.Medium });
      const freshProducts = products.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p));
      setProducts(freshProducts);

      if (isStrictMode() && user?.uid) {
        syncProductsToCloud(freshProducts, deletedProducts).then(cloudData => {
          setProducts(cloudData.products);
          setDeletedProducts(cloudData.deletedProducts);
        }).catch(err => console.error('Strict sync failed:', err));
      }
    } else {
      // Show confirmation
      setConfirmToggleStock({ id, field });
    }
  };

  const handleMasterStockToggleRequest = (id) => {
    const bypassUntil = parseInt(sessionStorage.getItem("bypassStockWarningUntil") || "0", 10);
    const now = Date.now();

    if (now < bypassUntil) {
      // Bypassed within 5 minutes
      Haptics.impact({ style: ImpactStyle.Medium });
      const freshProducts = products.map((p) => {
        if (p.id === id) {
          const allInStock = catalogues.every((cat) => p[cat.stockField]);
          const updated = { ...p };
          catalogues.forEach((cat) => {
            updated[cat.stockField] = !allInStock;
          });
          return updated;
        }
        return p;
      });
      setProducts(freshProducts);

      if (isStrictMode() && user?.uid) {
        syncProductsToCloud(freshProducts, deletedProducts).then(cloudData => {
          setProducts(cloudData.products);
          setDeletedProducts(cloudData.deletedProducts);
        }).catch(err => console.error('Strict sync failed:', err));
      }
    } else {
      // Show confirmation with special flag for master toggle
      setConfirmToggleStock({ id, field: "MASTER" });
    }
  };

  const updateProduct = (item) => {
    const freshProducts = products.map((p) => (p.id === item.id ? item : p));
    setProducts(freshProducts);

    // Clear image cache for this product to force reload from updated imageUrl
    setImageMap((prev) => {
      const updated = { ...prev };
      delete updated[item.id];
      return updated;
    });

    if (isStrictMode() && user?.uid) {
      syncProductsToCloud(freshProducts, deletedProducts).then(cloudData => {
        setProducts(cloudData.products);
        setDeletedProducts(cloudData.deletedProducts);
      }).catch(err => console.error('Strict sync failed:', err));
    }
  };

  const handleRenderAllImages = async (forceRerender: boolean = true) => {
    const all = products;
    if (all.length === 0) return;

    const cats = getAllCatalogues();

    // Prevent screen from sleeping during rendering
    try {
      if (isNative) {
        await KeepAwake.keepAwake();
        console.log("🔓 Screen wakelock acquired for full rendering");
      }
    } catch (e) {
      console.warn("Could not acquire keep awake lock:", e);
    }

    // If forcing re-render, delete all existing rendered images first
    if (forceRerender) {
      console.log("🗑️ Force re-render enabled - clearing all rendered images...");
      for (const cat of cats) {
        const folderName = cat.folder || cat.label;
        try {
          const result = await Filesystem.readdir({
            path: folderName,
            directory: Directory.External,
          });

          if (result.files && result.files.length > 0) {
            for (const file of result.files) {
              try {
                await Filesystem.deleteFile({
                  path: `${folderName}/${file.name}`,
                  directory: Directory.External,
                });
                console.log(`  ✓ Deleted: ${file.name}`);
              } catch (err) {
                console.warn(`  ⚠️ Could not delete ${file.name}:`, err.message);
              }
            }
            console.log(`✅ Cleared ${result.files.length} images from ${folderName}`);
          }
        } catch (err) {
          // Folder might not exist yet, which is fine
          if (err.code !== 'NotFound') {
            console.warn(`⚠️ Could not clear folder ${folderName}:`, err.message);
          }
        }
      }
      console.log("✅ Cache cleared. Re-rendering all images with latest settings...");
    }

    // Force synchronous state updates so overlay renders with correct total
    flushSync(() => {
      propSetIsRendering?.(true);
      propSetRenderProgress?.(0);
      propSetRenderingTotal?.(all.length);
    });

    const totalRenders = all.length * cats.length;
    let renderedCount = 0;

    try {
      for (let i = 0; i < all.length; i++) {
        const product = all[i];

        // Inject base64 from imageMap (used in CatalogueApp)
        if (!product.image && imageMap[product.id]) {
          product.image = imageMap[product.id];
        }

        // Skip products without images - don't error, just skip
        if (!product.image && !product.imagePath && !product.imageUrl) {
          console.warn(`⚠️ Skipping ${product.name} - no image available`);
          flushSync(() => propSetRenderProgress?.((i + 1)));
          continue;
        }

        try {
          // Render for all catalogues
          for (const cat of cats) {
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
            // Calculate which product we're on (product index, not total render count)
            const productIndex = Math.floor(renderedCount / cats.length);
            flushSync(() => propSetRenderProgress?.(productIndex));
          }

          console.log(`✅ Rendered images for ${product.name} (${cats.length} catalogues)`);
        } catch (err) {
          console.warn(`❌ Failed to render images for ${product.name}`, err);
        }
      }

      propSetRenderResult?.({
        status: "success",
        message: `Image rendering completed for all products and catalogues`,
      });
      propSetIsRendering?.(false);
      window.dispatchEvent(new CustomEvent("renderComplete"));
    } catch (err) {
      console.error("❌ Rendering failed:", err);
      propSetRenderResult?.({
        status: "error",
        message: `Rendering error: ${err.message}`,
      });
      propSetIsRendering?.(false);
      window.dispatchEvent(new CustomEvent("renderComplete"));
    } finally {
      // Re-enable screen sleeping after rendering is done
      try {
        if (isNative) {
          await KeepAwake.allowSleep();
          console.log("🔒 Screen wakelock released after full rendering");
        }
      } catch (e) {
        console.warn("Could not release keep awake lock:", e);
      }
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this product?");
    if (!confirmDelete) return;
    const toDelete = products.find((p) => p.id === id);
    if (toDelete) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      const freshProducts = products.filter((p) => p.id !== id);
      const freshDeleted = [toDelete, ...deletedProducts];
      setProducts(freshProducts);
      setDeletedProducts(freshDeleted);

      if (isStrictMode() && user?.uid) {
        syncProductsToCloud(freshProducts, freshDeleted).then(cloudData => {
          setProducts(cloudData.products);
          setDeletedProducts(cloudData.deletedProducts);
        }).catch(err => console.error('Strict sync failed:', err));
      }

      // 🧹 Clean up rendered images for this product to save space
      // They can be re-rendered if the product is restored
      try {
        await deleteRenderedImageForProduct(id);
      } catch (err) {
        console.warn(`⚠️ Failed to clean up rendered images for product ${id}:`, err);
      }
    }
  };

  const handlePermanentDelete = async (id) => {
    if (window.confirm("Permanently delete this item?")) {
      const product = deletedProducts.find(p => p.id === id);
  
      await deleteProductSourceImagesBestEffort(product || { id });
  
      // Delete image from R2 if product has a cloud URL
      if (product?.imageUrl && !product.imageUrl.startsWith('undefined')) {
        try {
          const { deleteImageFromR2 } = await import('./services/cloudflareService');
          await deleteImageFromR2(product.imageUrl);
        } catch (err) {
          console.warn("⚠️ Could not delete R2 image:", err);
        }
      }
  
      // ✅ Delete from Supabase (both products and deleted_products tables)
      if (user?.uid) {
        try {
          const { deleteProductFromSupabase } = await import('./services/supabaseSync');
          const result = await deleteProductFromSupabase(user.uid, id);
          if (!result.success) {
            console.warn("⚠️ Supabase delete failed:", result.error);
          } else {
            console.log(`✅ Product ${id} permanently deleted from Supabase`);
          }
        } catch (err) {
          console.warn("⚠️ Could not delete from Supabase:", err);
        }
      }
  
      // Remove from local state
      const freshDeleted = deletedProducts.filter((p) => p.id !== id);
      setDeletedProducts(freshDeleted);

      if (isStrictMode() && user?.uid) {
        syncProductsToCloud(products, freshDeleted).then(cloudData => {
          setProducts(cloudData.products);
          setDeletedProducts(cloudData.deletedProducts);
        }).catch(err => console.error('Strict sync failed:', err));
      }
    }
  };

  const getLighterColor = (color) => {
    if (!color || typeof color !== "string") return "#f0f0f0";
    if (color.startsWith("#") && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const lighten = (c) => Math.min(255, c + 40);
      return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
    }
    const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      const lighten = (c) => Math.min(255, c + 40);
      return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
    }
    return color;
  };

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(q) || (p.subtitle && p.subtitle.toLowerCase().includes(q))
    );
  }, [products, search]);

  const visible = useMemo(() => {
    const v = [...filtered];
    if (sortBy === "name") v.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sortBy.endsWith(":out")) {
      const field = sortBy.replace(":out", "");
      v.sort((a, b) => (a[field] ? 1 : -1));
    }
    else if (sortBy === "wholesaleStock") v.sort((a, b) => a.wholesaleStock ? -1 : 1);
    else if (sortBy === "resellStock") v.sort((a, b) => a.resellStock ? -1 : 1);
    else if (sortBy === "category") v.sort((a, b) => {
      const aCat = Array.isArray(a.category) ? a.category[0] || "" : (a.category || "");
      const bCat = Array.isArray(b.category) ? b.category[0] || "" : (b.category || "");
      return (aCat || "").localeCompare(bCat || "");
    });
    return v;
  }, [filtered, sortBy, catalogues]);

  // After /create: restore exact main.scrollTop. ResizeObserver re-applies as list height grows (images).
  useEffect(() => {
    if (pathname !== "/" || tab !== "products") return;
    const raw = localStorage.getItem(PRODUCT_SCROLL_KEY);
    if (raw == null) return;
    const target = parseFloat(raw);
    if (Number.isNaN(target) || target < 0) {
      localStorage.removeItem(PRODUCT_SCROLL_KEY);
      return;
    }
    if (visible.length === 0) {
      localStorage.removeItem(PRODUCT_SCROLL_KEY);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const clearKey = () => {
      localStorage.removeItem(PRODUCT_SCROLL_KEY);
    };

    let ro: ResizeObserver | null = null;
    const node = scrollRef.current;

    /** Apply exact pixel scroll; returns true when target is reachable or we're pinned at bottom. */
    const applyExactScroll = (): boolean => {
      if (cancelled) return true;
      const el = scrollRef.current;
      if (!el) return true;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const y = Math.min(target, maxScroll);
      el.scrollTop = y;

      const reached = maxScroll + 0.5 >= target;
      const pinnedBottom = target > maxScroll && maxScroll > 0 && Math.abs(y - maxScroll) < 1.5;
      return reached || pinnedBottom;
    };

    /** Must run once restore is done or timed out — otherwise RO/load keep forcing old scrollTop. */
    const finishRestore = () => {
      if (cancelled) return;
      cancelled = true;
      ro?.disconnect();
      ro = null;
      node?.removeEventListener("load", onImgLoadCapture, true);
      timers.forEach(clearTimeout);
      timers.length = 0;
      clearKey();
    };

    const onImgLoadCapture = () => {
      if (cancelled) return;
      if (applyExactScroll()) finishRestore();
    };

    if (node) {
      node.addEventListener("load", onImgLoadCapture, true);
    }
    if (node && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (cancelled) return;
        if (applyExactScroll()) finishRestore();
      });
      ro.observe(node);
      const droppable = node.querySelector('[data-rbd-droppable-id="product-list"]');
      if (droppable) ro.observe(droppable);
    }

    const tick = () => {
      if (cancelled) return true;
      if (applyExactScroll()) {
        finishRestore();
        return true;
      }
      return false;
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) tick();
      });
    });

    [0, 16, 50, 100, 200, 400, 700, 1200, 2000].forEach((ms) => {
      timers.push(
        setTimeout(() => {
          if (tick()) return;
        }, ms)
      );
    });

    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        applyExactScroll();
        finishRestore();
      }, 2800)
    );

    return () => {
      cancelled = true;
      ro?.disconnect();
      node?.removeEventListener("load", onImgLoadCapture, true);
      timers.forEach(clearTimeout);
    };
  }, [pathname, tab, visible.length, products.length]);


  return (
    <div
      className="w-full h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-white to-gray-100"
    >
      <Outlet />

      {tab === "products" && (
        <>
          <div className="fixed inset-x-0 top-0 h-[40px] bg-black z-50"></div>
          <div className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <header className="relative h-14 flex items-center gap-3 px-4">
        
          {/* Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`relative w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 transition-opacity duration-200 ${
              showSearch ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            aria-label="Menu"
            title="Menu"
          >
              <span className="absolute w-6 h-0.5 bg-gray-700" style={{ top: '50%', transform: 'translateY(-8px)' }} />
              <span className="absolute w-6 h-0.5 bg-gray-700" style={{ top: '50%', transform: 'translateY(0px)' }} />
              <span className="absolute w-6 h-0.5 bg-gray-700" style={{ top: '50%', transform: 'translateY(8px)' }} />
          </button>

          {/* Center Title */}
          {!showSearch && (
            <h1
              className="text-xl font-bold text-center flex-1 cursor-pointer transition-opacity duration-200 flex items-center justify-center leading-none"
              onClick={() => {
                navigate("/");
              }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <img src="https://cdn.builder.io/api/v1/image/assets%2F4b59de728c4149beae05f37141fcdb10%2Ff76700758c784ae1b7f01d6405d61f53?format=webp&width=800" alt="Catalogue Share" className="w-10 h-10 sm:w-12 sm:h-12 rounded object-contain shrink-0" />
                <span>CatShare</span>
              </span>
            </h1>
          )}

          {showSortMenu && (
            <div
              className="absolute top-14 right-4 z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-48 animate-dropdown overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { label: "Original", value: "" },
                { label: "A - Z", value: "name" },
                { label: "In Stock", value: catalogues[0]?.stockField || "wholesaleStock" },
                { label: "Out of Stock", value: `${catalogues[0]?.stockField || "wholesaleStock"}:out` },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSort(option.value)}
                  className={`w-full text-left px-4 py-3 text-sm tracking-wide hover:bg-gray-50 transition-all ${
                    sortBy === option.value ? "bg-gray-100 font-semibold text-blue-600" : "text-gray-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* Flexible Spacer */}
          <div className="flex-1" />

          {/* Expanding Search Box (larger, smoother) */}
          <div
            className={`transition-all duration-300 flex items-center overflow-hidden ${
              showSearch ? "w-80 opacity-100 scale-10" : "w-0 opacity-0 scale-95"
            }`}
          >
            <div className="relative w-full h-9">
              <input
                type="text"
                placeholder="Search..."
                className="w-full h-full px-3 pr-8 text-sm border border-gray-300 rounded-md shadow-inner bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                ref={searchInputRef}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Fixed Icons Group (Glass + Sort) */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setShowSearch((prev) => !prev)}
              className="text-xl text-gray-600 hover:text-black"
              title="Search"
            >
              <FiSearch />
            </button>

            <button
              onClick={() => window.dispatchEvent(new Event("toggle-sort"))}
              className="text-xl text-gray-600 hover:text-black"
              title="Sort"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M10 17h8" />
              </svg>
            </button>

            <button
              onClick={() => window.open("https://docs.google.com/forms/d/e/1FAIpQLSeRdoXJAaLXEpuyGZa3de45urVBCO86mvSUr2HO6xoHJzLlCQ/viewform?usp=dialog", "_blank")}
              className="text-xl text-gray-600 hover:text-blue-600 transition-colors"
              title="Send Feedback"
              aria-label="Send Feedback"
            >
              <FiMessageSquare />
            </button>
          </div>
        </header>
          </div>
        </>
      )}


      <main ref={scrollRef} className={`flex-1 min-h-0 overflow-y-auto ${tab === 'products' ? 'pt-6' : ''} px-4 pb-24`}>
        {tab === "products" &&
          visible.length === 0 &&
          (startupPhase !== "done" || !catalogueFirstLoadSettled) && (
          <div
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading products"
          >
            <div className="w-52 h-52" aria-hidden>
              <Lottie
                animationData={syncAnimationData}
                loop
                autoplay
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <p className="text-gray-800 font-semibold text-lg mt-2 text-center px-4">
              Loading products…
            </p>
            <p className="text-gray-500 text-sm mt-1 text-center px-4">Fetching your catalogue</p>
          </div>
        )}

        {tab === "products" &&
          visible.length === 0 &&
          startupPhase === "done" &&
          catalogueFirstLoadSettled && (
          <EmptyStateIntro
            onCreateProduct={() => navigate("/create")}
            onBulkAddFromGallery={() => navigate("/create-bulk")}
          />
        )}

        {tab === "products" && visible.length > 0 && (
          <DragDropContext onDragEnd={({ source, destination }) => {
            if (!destination) return;
            if (source.droppableId !== destination.droppableId) return;
            if (source.index === destination.index) return;

            const newVisible = reorderList(visible, source.index, destination.index);
            const copy = applyVisibleOrderToProducts(products, visible, newVisible);
            setProducts(copy);
            window.dispatchEvent(new CustomEvent("sync-to-supabase"));

            if (isStrictMode() && user?.uid) {
              void syncProductsToCloud(copy, deletedProducts, {
                background: true,
                skipFullCloudRefresh: true,
              }).catch((err) => console.error('Strict sync failed:', err));
            }
          }}>
            <Droppable droppableId="product-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 mt-4">
                  {visible.map((p, index) => (
                    <Draggable key={p.id} draggableId={p.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          data-product-row-id={p.id}
                          className="bg-white rounded-lg shadow p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between"
                        >
                          {/* Left: Name + Subtitle + Drag + Image */}
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => {
                              setPreviewProduct(p);
                              setPreviewList(visible);
                            }}
                          >
                            <div {...provided.dragHandleProps} className="text-gray-400 shrink-0">
                              ☰
                            </div>
                            <div className="w-14 h-14 rounded border bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {imageMap[p.id] || productImageDisplayUrl(p.imageUrl, p.imageVersion) ? (
                                <img
                                  key={imageMap[p.id] || productImageDisplayUrl(p.imageUrl, p.imageVersion)}
                                  src={imageMap[p.id] || productImageDisplayUrl(p.imageUrl, p.imageVersion)}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.parentElement.innerHTML =
                                      '<span class="text-[10px] text-gray-400">Failed to load</span>';
                                  }}
                                />
                              ) : (
                                <span className="text-[10px] text-gray-400">Loading...</span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{p.name}</div>
                              <div className="text-xs text-gray-500 truncate">{p.subtitle}</div>
                            </div>
                          </div>

                          {/* Buttons: Stay right even when wrapped on small screens */}
                          <div className="w-full sm:w-auto flex justify-end mt-3 sm:mt-0 sm:ml-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                onClick={() => {
                                  persistProductsListScrollForEdit(scrollRef.current);
                                  navigate(`/create?id=${p.id}`);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <FiEdit size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setShelfTarget(p);
                                  setShowShelfConfirm(true);
                                }}
                                className="text-red-500 hover:text-red-800"
                                title="Shelf Item"
                              >
                                <MdInventory2 className="text-[18px]" />
                              </button>

                              {/* Master Toggle Button - All Catalogues */}
                              <button
                                onClick={() => handleMasterStockToggleRequest(p.id)}
                                className={`text-xs font-semibold px-2 py-1 rounded ${
                                  catalogues.every((cat) => (p as any)[cat.stockField])
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-300 text-gray-700"
                                }`}
                                title="Toggle all catalogues"
                              >
                                {catalogues.every((cat) => (p as any)[cat.stockField]) ? "In Stock" : "Out of Stock"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {showShelfConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => {
              setShowShelfConfirm(false);
              setShelfTarget(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Shelf this item now?
              </h2>
              <p className="text-sm text-gray-600 mb-5">
                It stays safe and can be restored or deleted later.
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-800 transition"
                  onClick={async () => {
                    if (shelfTarget) {
                      console.log('🗑️ Shelf button clicked for product:', shelfTarget.id);
                      await Haptics.impact({ style: ImpactStyle.Heavy });
                      // ✅ CRITICAL: Get the complete product object from the products array, not from stale shelfTarget
                      // This ensures all product data (including catalogueData, fields, etc.) is preserved
                      const completeProduct = products.find(p => p.id === shelfTarget.id);
                      if (!completeProduct) {
                        console.warn("Product not found in products array, using shelfTarget as fallback");
                      }
                      const productToShelf = completeProduct || shelfTarget;

                      const freshProducts = products.filter((x) => x.id !== productToShelf.id);
                      const freshDeleted = [productToShelf, ...deletedProducts];
                      console.log('📦 Shelf state updated:', {
                        productName: productToShelf.name,
                        productsCount: freshProducts.length,
                        deletedCount: freshDeleted.length
                      });
                      setProducts(freshProducts);
                      setDeletedProducts(freshDeleted);

                      // Direct sync like updateProduct for faster response
                      if (isStrictMode() && user?.uid) {
                        console.log('📤 Direct sync for shelved product');
                        syncProductsToCloud(freshProducts, freshDeleted).then(cloudData => {
                          setProducts(cloudData.products);
                          setDeletedProducts(cloudData.deletedProducts);
                        }).catch(err => console.error('Shelf sync failed:', err));
                      }

                      // If currently previewing this item, move to next
                      if (previewProduct && previewProduct.id === productToShelf.id) {
                        const idx = previewList.findIndex(p => p.id === productToShelf.id);
                        if (idx !== -1) {
                          const newPreviewList = previewList.filter(p => p.id !== productToShelf.id);
                          setPreviewList(newPreviewList);
                          if (newPreviewList.length > 0) {
                            const nextIdx = idx < newPreviewList.length ? idx : newPreviewList.length - 1;
                            setPreviewProduct(newPreviewList[nextIdx]);
                          } else {
                            setPreviewProduct(null);
                          }
                        } else {
                          setPreviewProduct(null);
                        }
                      } else {
                        // Even if not previewing it, update the list in background
                        setPreviewList(prev => prev.filter(p => p.id !== productToShelf.id));
                      }
                    }
                    setShowShelfConfirm(false);
                    setShelfTarget(null);
                  }}
                >
                  Shelf
                </button>
                {showHiddenDangerShelfActions && (
                <button
                  className="px-4 py-2 bg-orange-600 text-white rounded-full hover:bg-orange-800 transition"
                  onClick={async () => {
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                    // Move all products to shelf
                    const freshDeleted = [...deletedProducts, ...products];
                    setDeletedProducts(freshDeleted);
                    setProducts([]);
                    setPreviewProduct(null);
                    setPreviewList([]);

                    // Direct sync like updateProduct for faster response
                    if (isStrictMode() && user?.uid) {
                      console.log('📤 Direct sync for shelf all');
                      syncProductsToCloud([], freshDeleted).then(cloudData => {
                        setProducts(cloudData.products);
                        setDeletedProducts(cloudData.deletedProducts);
                      }).catch(err => console.error('Shelf all sync failed:', err));
                    }

                    setShowShelfConfirm(false);
                    setShelfTarget(null);
                  }}
                >
                  Shelf All
                </button>
                )}
                <button
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-full hover:bg-gray-400 transition"
                  onClick={() => {
                    setShowShelfConfirm(false);
                    setShelfTarget(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmToggleStock && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full text-center">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Heads up!</h2>
              <p className="text-sm text-gray-600 mb-2">
                You're about to change stock status{confirmToggleStock.field === "MASTER" ? " for all catalogues" : ""}. Are you sure?
              </p>

              <label className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={bypassChecked}
                  onChange={(e) => setBypassChecked(e.target.checked)}
                />
                Don't show this again for 5 minutes
              </label>

              <div className="flex justify-center gap-4 mt-5">
                <button
                  className="px-4 py-2 rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
                  onClick={() => {
                    setConfirmToggleStock(null);
                    setBypassChecked(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
                  onClick={() => {
                    const { id, field } = confirmToggleStock;

                    if (bypassChecked) {
                      sessionStorage.setItem("bypassStockWarningUntil", (Date.now() + 5 * 60 * 1000).toString());
                    }

                    Haptics.impact({ style: ImpactStyle.Medium });

                    let freshProducts: any[];
                    if (field === "MASTER") {
                      freshProducts = products.map((p) => {
                        if (p.id === id) {
                          const allInStock = catalogues.every((cat) => p[cat.stockField]);
                          const updated = { ...p };
                          catalogues.forEach((cat) => {
                            updated[cat.stockField] = !allInStock;
                          });
                          return updated;
                        }
                        return p;
                      });
                    } else {
                      freshProducts = products.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p));
                    }
                    setProducts(freshProducts);

                    if (isStrictMode() && user?.uid) {
                      syncProductsToCloud(freshProducts, deletedProducts).then(cloudData => {
                        setProducts(cloudData.products);
                        setDeletedProducts(cloudData.deletedProducts);
                      }).catch(err => console.error('Strict sync failed:', err));
                    }

                    setConfirmToggleStock(null);
                    setBypassChecked(false);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "catalogues" && selectedCatalogueInCataloguesTab === null && (
          <div className="relative -mx-4">
            <CataloguesList
              catalogues={catalogues}
              onSelectCatalogue={(catalogueId) => {
                setSelectedCatalogueInCataloguesTab(catalogueId);
                navigate(`/catalogues?catalogue=${encodeURIComponent(catalogueId)}`);
              }}
              imageMap={imageMap}
              products={products}
              onManageCatalogues={() => setShowManageCatalogues(true)}
              renamingCatalogueIds={renamingCatalogueIds}
            />
          </div>
        )}

        {tab === "catalogues" && selectedCatalogueInCataloguesTab && (
          <div className="relative -mx-4">
            {/* Black bar for catalogues */}
            <div className="fixed inset-x-0 top-0 h-[40px] bg-black z-50"></div>
            {/* Render the selected catalogue */}
            {(() => {
              const selectedCat = catalogues.find((c) => c.id === selectedCatalogueInCataloguesTab);
              if (!selectedCat) return null;

              return (
                <div key={selectedCat.id}>
                  <CatalogueView
                    filtered={visible}
                    allProducts={products}
                    setProducts={setProducts}
                    selected={selected}
                    setSelected={setSelected}
                    getLighterColor={getLighterColor}
                    imageMap={imageMap}
                    catalogueId={selectedCat.id}
                    catalogueLabel={selectedCat.label}
                    priceField={selectedCat.priceField}
                    priceUnitField={selectedCat.priceUnitField}
                    stockField={selectedCat.stockField}
                    onBack={() => {
                      setSelected([]);
                      setSelectedCatalogueInCataloguesTab(null);
                      navigate('/catalogues', { replace: true });
                    }}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {previewProduct && (
          <ProductPreviewModal
            product={previewProduct}
            tab={tab}
            catalogueId={selectedCatalogueInCataloguesTab}
            filteredProducts={previewList}
            onClose={() => setPreviewProduct(null)}
            onEdit={() => {
              persistProductsListScrollForEdit(scrollRef.current);
              navigate(`/create?id=${previewProduct.id}`);
            }}
            onToggleStock={(fieldOrProduct, isMasterToggle) => {
              let updated;

              if (isMasterToggle && typeof fieldOrProduct === 'object') {
                // Master toggle: fieldOrProduct is the complete updated product
                updated = fieldOrProduct;
              } else {
                // Individual toggle: fieldOrProduct is a field string
                const field = fieldOrProduct;
                updated = { ...previewProduct, [field]: !previewProduct[field] };
              }

              updateProduct(updated);
              setPreviewProduct(updated);
            }}
            onSwipeLeft={(next) => setPreviewProduct(next)}
            onSwipeRight={(prev) => setPreviewProduct(prev)}
            onShelf={(product) => {
              // Perform shelf action directly since ProductPreviewModal already showed confirmation
              const toShelf = product || previewProduct;
              if (!toShelf) return;

              Haptics.impact({ style: ImpactStyle.Heavy });

              // ✅ CRITICAL: Get the complete product object from the products array, not from stale reference
              // This ensures all product data (including catalogueData, fields, etc.) is preserved
              const completeProduct = products.find(p => p.id === toShelf.id);
              if (!completeProduct) {
                console.warn("Product not found in products array, using toShelf as fallback");
              }
              const productToShelf = completeProduct || toShelf;

              const freshProducts = products.filter((p) => p.id !== productToShelf.id);
              const freshDeleted = [productToShelf, ...deletedProducts];
              setProducts(freshProducts);
              setDeletedProducts(freshDeleted);

              // Direct sync like updateProduct for faster response
              if (isStrictMode() && user?.uid) {
                console.log('📤 Direct sync for shelved product from preview');
                syncProductsToCloud(freshProducts, freshDeleted).then(cloudData => {
                  setProducts(cloudData.products);
                  setDeletedProducts(cloudData.deletedProducts);
                }).catch(err => console.error('Preview shelf sync failed:', err));
              }

              // Move to next item in preview
              const idx = previewList.findIndex(p => p.id === productToShelf.id);
              if (idx !== -1) {
                const newPreviewList = previewList.filter(p => p.id !== productToShelf.id);
                setPreviewList(newPreviewList);

                if (newPreviewList.length > 0) {
                  const nextIdx = idx < newPreviewList.length ? idx : newPreviewList.length - 1;
                  setPreviewProduct(newPreviewList[nextIdx]);
                } else {
                  setPreviewProduct(null);
                }
              } else {
                setPreviewProduct(null);
              }
            }}
          />
        )}
      </main>

      <MainAppBottomNav active={pathname === "/catalogues" ? "catalogues" : "products"} />

      {tab === "products" && (
        <>
          {/* Sibling of FAB column so z-40 is not trapped under in-parent z-35 scrim */}
          <AnimatePresence>
            {productFabExpanded && (
              <motion.div
                key="fab-scrim"
                role="presentation"
                className="fixed inset-0 z-[35] cursor-default bg-slate-900/45 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setProductFabExpanded(false)}
              />
            )}
          </AnimatePresence>

          <div
            className="fixed right-4 z-40 flex flex-col items-end gap-3"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
          >
          <AnimatePresence>
            {productFabExpanded && (
              <motion.div
                key="fab-actions"
                className="flex min-h-0 flex-col-reverse items-end gap-2.5"
                initial={false}
                aria-hidden={false}
              >
                <motion.button
                  type="button"
                  custom={0}
                  variants={fabDialItem}
                  initial="hidden"
                  animate="visible"
                  exit="leave"
                  onClick={async () => {
                    await Haptics.impact({ style: ImpactStyle.Medium });
                    setProductFabExpanded(false);
                    navigate("/create-bulk");
                  }}
                  className="group flex min-h-[52px] items-center gap-3 rounded-2xl py-2 pl-4 pr-2 text-left text-white shadow-xl shadow-indigo-500/35 ring-1 ring-white/15 transition-[box-shadow,filter] hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/40 hover:brightness-105 active:scale-[0.98] active:brightness-95 sm:pl-5"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed 0%, #4f46e5 45%, #4338ca 100%)",
                  }}
                  title="Bulk add from gallery"
                  aria-label="Bulk add from gallery"
                >
                  <div className="min-w-0 pr-1 text-right">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                      Gallery
                    </div>
                    <div className="text-[15px] font-bold tracking-tight">Bulk import</div>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner ring-1 ring-white/25 backdrop-blur-sm transition-transform group-hover:scale-105">
                    <FiImage size={20} className="opacity-95" strokeWidth={2.25} />
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  custom={1}
                  variants={fabDialItem}
                  initial="hidden"
                  animate="visible"
                  exit="leave"
                  onClick={async () => {
                    await Haptics.impact({ style: ImpactStyle.Medium });
                    setProductFabExpanded(false);
                    navigate("/create");
                  }}
                  className="group flex min-h-[52px] items-center gap-3 rounded-2xl py-2 pl-4 pr-2 text-left text-white shadow-xl shadow-sky-500/35 ring-1 ring-white/15 transition-[box-shadow,filter] hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sky-500/40 hover:brightness-105 active:scale-[0.98] active:brightness-95 sm:pl-5"
                  style={{
                    background:
                      "linear-gradient(135deg, #0ea5e9 0%, #2563eb 50%, #1d4ed8 100%)",
                  }}
                  title="Create one product"
                  aria-label="Create one product"
                >
                  <div className="min-w-0 pr-1 text-right">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                      New
                    </div>
                    <div className="text-[15px] font-bold tracking-tight">Single product</div>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner ring-1 ring-white/25 backdrop-blur-sm transition-transform group-hover:scale-105">
                    <FiPlus size={22} className="opacity-95" strokeWidth={2.5} />
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={async () => {
              await Haptics.impact({ style: ImpactStyle.Light });
              setProductFabExpanded((v) => !v);
            }}
            animate={{ rotate: productFabExpanded ? 45 : 0 }}
            whileTap={{ scale: 0.92 }}
            transition={{
              rotate: { type: "spring", stiffness: 400, damping: 24 },
            }}
            className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl shadow-blue-600/45 ring-2 ring-white/20 ring-offset-2 ring-offset-transparent hover:shadow-blue-500/55"
            style={{
              background: "linear-gradient(145deg, #38bdf8 0%, #2563eb 42%, #1e40af 100%)",
            }}
            aria-expanded={productFabExpanded}
            aria-haspopup="menu"
            aria-label={productFabExpanded ? "Close create options" : "Create product"}
            title="Create"
          >
            <FiPlus size={26} strokeWidth={2.75} />
            {productFabExpanded && (
              <span
                className="pointer-events-none absolute inset-0 rounded-full bg-white/10"
                aria-hidden
              />
            )}
          </motion.button>
          </div>
        </>
      )}

      <SideDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        products={products}
        imageMap={imageMap}
        setProducts={setProducts}
        setDeletedProducts={setDeletedProducts}
        selected={selected}
        onShowTutorial={() => {
          setShowTutorial(true);
          setMenuOpen(false);
        }}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isRendering={isRendering}
        renderProgress={renderProgress}
        renderResult={renderResult}
        setRenderResult={setRenderResult}
        handleRenderAllImages={handleRenderAllImages}
      />

      {showManageCatalogues && (
        <ManageCatalogues
          onClose={() => {
            setShowManageCatalogues(false);
            // Refresh catalogues after management
            const updated = getAllCatalogues();
            setCatalogues(updated);
          }}
          onCataloguesChanged={(newCatalogues) => {
            setCatalogues(newCatalogues);
          }}
          products={products}
          setProducts={setProducts}
          renamingCatalogueIds={renamingCatalogueIds}
        />
      )}

      <RatingModal
        isOpen={showRatingModal}
        productCount={productCountForRating}
        onClose={() => {
          setShowRatingModal(false);
        }}
      />
    </div>
  );
}
