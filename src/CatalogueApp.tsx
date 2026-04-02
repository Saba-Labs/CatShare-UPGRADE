import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { flushSync } from "react-dom";
import { FiPlus, FiSearch, FiTrash2, FiEdit, FiMenu, FiMessageSquare, FiShoppingCart } from "react-icons/fi";
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
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import { useSync } from "./context/SyncContext";
import { safeGetFromStorage, getStorageKey } from "./utils/safeStorage";
import {
  tryReadProductSourceAsDataUrl,
  deleteProductSourceImagesBestEffort,
} from "./utils/productSourceImage";
import { HIDDEN_MENU_UNLOCKED_EVENT } from "./utils/hiddenMenuFeatures";

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

export default function CatalogueApp({ products, setProducts, deletedProducts, setDeletedProducts, darkMode, setDarkMode, isRendering: propIsRendering, setIsRendering: propSetIsRendering, renderProgress: propRenderProgress, setRenderProgress: propSetRenderProgress, renderingTotal: propRenderingTotal, setRenderingTotal: propSetRenderingTotal, renderResult: propRenderResult, setRenderResult: propSetRenderResult, showTutorial, setShowTutorial }: { products: any[]; setProducts: React.Dispatch<React.SetStateAction<any[]>>; deletedProducts: any[]; setDeletedProducts: React.Dispatch<React.SetStateAction<any[]>>; darkMode: boolean; setDarkMode: React.Dispatch<React.SetStateAction<boolean>>; isRendering?: boolean; setIsRendering?: React.Dispatch<React.SetStateAction<boolean>>; renderProgress?: number; setRenderProgress?: React.Dispatch<React.SetStateAction<number>>; renderingTotal?: number; setRenderingTotal?: React.Dispatch<React.SetStateAction<number>>; renderResult?: any; setRenderResult?: React.Dispatch<React.SetStateAction<any>>; showTutorial?: boolean; setShowTutorial?: React.Dispatch<React.SetStateAction<boolean>> }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { syncProductsToCloud, isStrictMode } = useSync();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const isNative = Capacitor.getPlatform() !== "web";

  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [tab, setTab] = useState("products");
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

  // Handle catalogue query parameter - when returning from edit view
  useEffect(() => {
    const catalogueParam = searchParams.get("catalogue");
    const tabParam = searchParams.get("tab");

    if (tabParam === "catalogues" && catalogueParam) {
      // Set the tab and selected catalogue
      setTab("catalogues");
      setSelectedCatalogueInCataloguesTab(catalogueParam);

      // Clean up the URL to remove the query parameters
      navigate("/?tab=catalogues", { replace: true });
    }
  }, [searchParams, navigate]);

  // Handle rating modal query parameters - when returning from create product page
  useEffect(() => {
    const showRatingParam = searchParams.get("showRating");
    const productCountParam = searchParams.get("productCount");

    if (showRatingParam === "true" && productCountParam) {
      setShowRatingModal(true);
      setProductCountForRating(parseInt(productCountParam, 10));

      // Clean up the URL to remove the query parameters
      const baseUrl = searchParams.get("tab") === "catalogues" && searchParams.get("catalogue")
        ? `/?tab=catalogues&catalogue=${searchParams.get("catalogue")}`
        : "/";
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
  const [showSearch, setShowSearch] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewList, setPreviewList] = useState([]);
  const [imageMap, setImageMap] = useState({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [showShelfConfirm, setShowShelfConfirm] = useState(false);
  const [shelfTarget, setShelfTarget] = useState(null);
  const [showHiddenDangerShelfActions, setShowHiddenDangerShelfActions] = useState(false);

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
          const resolved = await tryReadProductSourceAsDataUrl(p);
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
        if (tab && (tab === "products" || tab === "catalogues")) {
          setTab(tab);
        }
        setPreviewList(list);
        setPreviewProduct(match);
      }
    };
    window.addEventListener("open-preview", handler);
    return () => window.removeEventListener("open-preview", handler);
  }, [products]);

  useEffect(() => {
    const handleEditProduct = (e) => {
      const { id, catalogueId, fromCatalogue } = e.detail || {};
      if (id) {
        localStorage.setItem("productScroll", scrollRef.current?.scrollTop || 0);
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
      const updated = uid
        ? safeGetFromStorage(getStorageKey("products", uid), [])
        : JSON.parse(localStorage.getItem("products") || "[]");
      setProducts(updated);
  
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      const savedY = localStorage.getItem("productScroll");
      if (savedY && scrollRef.current) {
        scrollRef.current.scrollTop = parseInt(savedY, 10);
        localStorage.removeItem("productScroll");
      }
    }, 1);
    return () => clearTimeout(timeout);
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

      // 4. If on catalogues tab (showing list), go back to products tab
      if (tab === "catalogues") {
        setTab("products");
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
  }, [tab, selectedCatalogueInCataloguesTab, isRendering]);

  const handleTabChange = (key) => {
    setTab(key);
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


  return (
    <div
      className="w-full min-h-[100dvh] flex flex-col bg-gradient-to-b from-white to-gray-100"
    >

      {tab === "products" && (
        <>
          <div className="fixed inset-x-0 top-0 h-[40px] bg-black z-50"></div>
          <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center gap-3 px-4 relative">
        
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
                setTab("products");
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
        </>
      )}


      <main ref={scrollRef} className={`flex-1 min-h-0 ${tab === 'products' ? 'overflow-y-auto pt-6' : ''} px-4 pb-24`}>
        {tab === "products" && visible.length === 0 && (
          <EmptyStateIntro onCreateProduct={() => navigate("/create")} />
        )}

        {tab === "products" && visible.length > 0 && (
          <DragDropContext onDragEnd={({ source, destination }) => {
            if (!destination) return;
            // Map visible indices to actual product indices by ID
            const movedProductId = visible[source.index]?.id;
            const targetProductId = visible[destination.index]?.id;

            if (!movedProductId || !targetProductId) return;

            const movedProductIndex = products.findIndex(p => p.id === movedProductId);
            const targetProductIndex = products.findIndex(p => p.id === targetProductId);

            if (movedProductIndex === -1 || targetProductIndex === -1) return;

            const copy = [...products];
const [removed] = copy.splice(movedProductIndex, 1);
const adjustedTargetIndex = movedProductIndex < targetProductIndex ? targetProductIndex - 1 : targetProductIndex;
copy.splice(adjustedTargetIndex, 0, removed);
setProducts(copy);
window.dispatchEvent(new CustomEvent("sync-to-supabase"));

if (isStrictMode() && user?.uid) {
  syncProductsToCloud(copy, deletedProducts).then(cloudData => {
    setProducts(cloudData.products);
    setDeletedProducts(cloudData.deletedProducts);
  }).catch(err => console.error('Strict sync failed:', err));
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
                              {imageMap[p.id] ? (
                                <img
                                  src={imageMap[p.id]}
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
                            </div>
                          </div>

                          {/* Buttons: Stay right even when wrapped on small screens */}
                          <div className="w-full sm:w-auto flex justify-end mt-3 sm:mt-0 sm:ml-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                onClick={() => {
                                  localStorage.setItem("productScroll", scrollRef.current?.scrollTop || 0);
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
                      setProducts(freshProducts);
                      setDeletedProducts(freshDeleted);

                      window.dispatchEvent(new CustomEvent("sync-to-supabase"));

                      if (isStrictMode() && user?.uid) {
                        syncProductsToCloud(freshProducts, freshDeleted).then(cloudData => {
                          setProducts(cloudData.products);
                          setDeletedProducts(cloudData.deletedProducts);
                        }).catch(err => console.error('Strict sync failed:', err));
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

                    window.dispatchEvent(new CustomEvent("sync-to-supabase"));

                    if (isStrictMode() && user?.uid) {
                      syncProductsToCloud([], freshDeleted).then(cloudData => {
                        setProducts(cloudData.products);
                        setDeletedProducts(cloudData.deletedProducts);
                      }).catch(err => console.error('Strict sync failed:', err));
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
            onEdit={() => navigate(`/create?id=${previewProduct.id}`)}
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

              window.dispatchEvent(new CustomEvent("sync-to-supabase"));

              if (isStrictMode() && user?.uid) {
                syncProductsToCloud(freshProducts, freshDeleted).then(cloudData => {
                  setProducts(cloudData.products);
                  setDeletedProducts(cloudData.deletedProducts);
                }).catch(err => console.error('Strict sync failed:', err));
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

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around text-sm font-medium pb-[env(safe-area-inset-bottom,0px)]">
        {/* Products tab */}
        <button
          onClick={async () => {
            await Haptics.impact({ style: ImpactStyle.Light });
            handleTabChange("products");
          }}
          className={`flex-1 py-3.5 text-center transition-all ${
            tab === "products"
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-600"
          }`}
        >
          Products
        </button>

        {/* Catalogues tab */}
        <button
          onClick={async () => {
            await Haptics.impact({ style: ImpactStyle.Light });
            handleTabChange("catalogues");
          }}
          className={`flex-1 py-3.5 text-center transition-all ${
            tab === "catalogues"
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-600"
          }`}
        >
          Catalogues
        </button>

        {/* Orders tab */}
        <button
          onClick={async () => {
            await Haptics.impact({ style: ImpactStyle.Light });
            navigate("/orders");
          }}
          className="flex-1 py-3.5 text-center transition-all bg-white text-gray-600 flex items-center justify-center"
        >
          <FiShoppingCart size={20} />
        </button>
      </nav>

      {tab === "products" && (
        <button
          onClick={async () => {
            await Haptics.impact({ style: ImpactStyle.Medium });
            navigate("/create");
          }}
          className="fixed right-4 z-40 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:scale-105 transition"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
        >
          <FiPlus size={24} />
        </button>
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
