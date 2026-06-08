// Generic Catalogue View Component
// Works with any catalogue (Master, Resell, custom, etc.)
import React, { useState, useMemo, useEffect, useRef, useCallback, Dispatch, SetStateAction } from "react";
import { flushSync } from "react-dom";
import { handleShare } from "./Share";
import { HiCheck } from "react-icons/hi";
import { FiPlus, FiEdit, FiImage, FiLink, FiMessageCircle } from "react-icons/fi";
import { FaRegFilePdf } from "react-icons/fa6";
import { MdLayers } from "react-icons/md";
import { RiEdit2Line } from "react-icons/ri";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { renderElementToCanvas, canvasToBlob } from "./utils/canvasRenderer";
import { AnimatePresence, motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App } from "@capacitor/app";
import { getCatalogueData, isProductEnabledForCatalogue } from "./config/catalogueProductUtils";
import { getFieldConfig, getAllFields } from "./config/fieldConfig";
import AddProductsModal from "./components/AddProductsModal";
import BulkEdit from "./BulkEdit";
import { getCurrentCurrencySymbol, getSellerCurrencyForShareLink, onCurrencyChange } from "./utils/currencyUtils";
import { generateProductPDF, downloadPDF, sharePDF, pdfFilenamePrefix } from "./utils/pdfUtils";
import { useAuth } from "./context/AuthContext";
import { useCloudWriteGate } from "./hooks/useCloudWriteGate";
import {
  createShareLink,
  productToShareLinkItem,
  SHARE_LINK_EXPIRY_PRESETS,
  type ShareLinkExpiryPresetId,
} from "./services/shareLinks";
import { resolveListOfferEffective, STRUCK_LIST_PRICE_STYLE } from "./utils/offerPriceUtils";
import { businessProfileFromUserSettings, getBusinessProfileForPdf } from "./config/businessProfile";
import { useSubscription } from "./context/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { parseWhatsAppNumber } from "./data/whatsappCountryCodes";
import { prepareSelectedProductsForPdfExport } from "./utils/pdfProductImages";
import { getProductVariantGroups } from "./utils/productVariants";
import {
  canConsumePdfToday,
  recordPdfConsumption,
  canCreateShareLinkToday,
  recordShareLinkConsumption,
} from "./utils/freeTierDailyQuota";

const ProductCard = React.memo(({
  p,
  isSelected,
  stockField,
  showEdit,
  showInfo,
  currencySymbol,
  imageMap,
  catalogueId,
  getLighterColor,
  getProductCatalogueData,
  priceField,
  onCardClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseUp,
  onMouseLeave,
}: any) => {
  const catData = getProductCatalogueData(p);
  const imageSrc = imageMap[p.id];
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [imageSrc]);

  useEffect(() => {
    if (!imageSrc) return;
    const imgEl = imageRef.current;
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, [imageSrc]);

  return (
    <div
  data-id={p.id}
  draggable={false}
  onDragStart={(e) => e.preventDefault()}
  className={`share-card bg-white rounded-sm shadow-sm overflow-hidden relative cursor-pointer transition-all duration-200 ${
    !p[stockField] ? "opacity-100" : ""
  }`}
  onClick={() => onCardClick(p.id)}
  onTouchStart={(e) => onTouchStart(e, p.id)}
  onTouchMove={onTouchMove}
  onTouchEnd={onTouchEnd}
  onMouseDown={(e) => onTouchStart(e, p.id)}
  onMouseUp={onMouseUp}
  onMouseLeave={onMouseLeave}
>
      <div className="relative aspect-square overflow-hidden bg-gray-100 group">
        {!!imageSrc && !imageLoaded && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-gray-100">
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              width: 36, height: 36,
              borderRadius: "50%",
              border: "3px solid rgba(0,0,0,0.1)",
              borderTopColor: "rgba(0,0,0,0.4)",
              animation: "spin 0.8s linear infinite",
            }} />
          </div>
        )}
        <img
  ref={imageRef}
  src={imageSrc}
  alt={p.name}
  className={`w-full h-full object-cover transition-opacity duration-150 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
  draggable={false}
  onDragStart={(e) => e.preventDefault()}
  onLoad={() => {
    setImageLoaded(true);
  }}
  onError={() => {
    setImageLoaded(false);
  }}
/>
      
        {!p[stockField] && (
          <div className="absolute top-1/2 left-1/2 w-[140%] -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] bg-red-500 bg-opacity-60 text-white text-center py-0.5 shadow-md">
            <span className="block text-sm font-bold tracking-wider">
              OUT OF STOCK
            </span>
          </div>
        )}

        {showEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const mainElement = document.querySelector('main');
              if (mainElement) {
                localStorage.setItem(`catalogueScroll-${catalogueId}`, mainElement.scrollTop.toString());
              }
              const evt = new CustomEvent("edit-product", {
                detail: { id: p.id, catalogueId, fromCatalogue: catalogueId },
              });
              window.dispatchEvent(evt);
            }}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors duration-200 z-10"
            title="Edit product"
          >
            <FiEdit className="w-4 h-4 text-blue-600" />
          </button>
        )}

        <AnimatePresence>
          {isSelected && (
            <>
              <motion.div
                key="overlay"
                className="absolute inset-0 z-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ backgroundColor: "black" }}
              />
              <div className="absolute inset-0 flex items-center justify-center z-6">
                <motion.div
                  key="tick"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl border border-white/40 backdrop-blur-sm"
                  style={{
                    backgroundColor: "rgba(19, 145, 67, 0.45)",
                    userSelect: "none",
                  }}
                >
                  <HiCheck className="text-green-100" style={{ fontSize: 30 }} />
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>

      {showInfo && (
        <div className="absolute top-1.5 left-1.5 bg-red-800 text-white text-[11px] font-medium px-2 py-0.45 rounded-full shadow-md tracking-wide z-10">
          {(() => {
            const row = getCatalogueData(p, catalogueId);
            const r = resolveListOfferEffective(row, priceField, p as Record<string, unknown>);
            if (r.showStrikeout) {
              return (
                <>
                  {currencySymbol}{r.offerPrice}
                  <span style={{ ...STRUCK_LIST_PRICE_STYLE, marginLeft: 3 }}>{currencySymbol}{r.listPrice}</span>
                </>
              );
            }
            return <>{currencySymbol}{r.effectiveUnitPrice || catData.price}</>;
          })()}
        </div>
      )}

      {showInfo && (
        <div
          className="absolute bottom-0 left-0 w-full px-1 py-1 text-center font-medium text-white text-[11px] sm:text-[12px] md:text-[14px] truncate"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(1px)",
          }}
        >
          {p.name}
        </div>
      )}

      {/* Share Preview Content - required for sharing */}
      <div
        className={`hidden full-detail-${p.id}`}
        style={{
          width: "100%", padding: 0, margin: 0,
          overflow: "hidden", boxSizing: "border-box", backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            backgroundColor: p.imageBgColor || "white",
            padding: "16px", textAlign: "center",
            position: "relative",
            boxShadow: "0 12px 15px -6px rgba(0, 0, 0, 0.4)",
          }}
        >
          <img
            src={imageMap[p.id]}
            alt={p.name}
            style={{ maxWidth: "100%", maxHeight: "300px", objectFit: "contain", margin: "0 auto" }}
          />
          {p.badge && (
            <div style={{
              position: "absolute", bottom: 8, right: 8,
              backgroundColor: p.imageBgColor?.toLowerCase() === "white" ? "#fff" : "#000",
              color: p.imageBgColor?.toLowerCase() === "white" ? "#000" : "#fff",
              fontSize: 11, fontWeight: 400, padding: "4px 9px",
              borderRadius: "20px", opacity: 0.98,
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              border: `1.5px solid ${p.imageBgColor?.toLowerCase() === "white" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"}`,
              letterSpacing: "0.3px", lineHeight: "1.4",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {p.badge.toUpperCase()}
            </div>
          )}
          {!p[stockField] && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%) rotate(-30deg)",
              width: "140%", backgroundColor: "rgba(220, 38, 38, 0.6)",
              color: "white", textAlign: "center", padding: "10px 0",
              fontSize: "18px", fontWeight: "bold",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              OUT OF STOCK
            </div>
          )}
        </div>

        <div style={{
          backgroundColor: getLighterColor(p.bgColor || "#add8e6"),
          color: p.fontColor || "white", padding: "4px 8px", fontSize: 17,
        }}>
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <p style={{ fontWeight: "normal", textShadow: "3px 3px 5px rgba(0,0,0,0.2)", fontSize: 28, margin: "0 0 3px 0" }}>
              {p.name}
            </p>
            {p.subtitle && (
              <p style={{ fontStyle: "italic", fontSize: 18, margin: "0 0 0 0" }}>
                ({p.subtitle})
              </p>
            )}
          </div>
          <div style={{ textAlign: "left", lineHeight: 1.4 }}>
            {getAllFields()
              .filter(f => f.enabled && f.key.startsWith('field'))
              .map(field => {
                const val = catData[field.key];
                if (!val) return null;
                const unit = catData[`${field.key}Unit`];
                const displayUnit = unit && unit !== "None" ? unit : "";
                return (
                  <p key={field.key} style={{ margin: "2px 0" }}>
                    &nbsp; {field.label}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;{val} {displayUnit}
                  </p>
                );
              })}
          </div>
        </div>

        <h2 style={{
          backgroundColor: p.bgColor || "#add8e6",
          color: p.fontColor || "white",
          padding: "5px 8px", textAlign: "center",
          fontWeight: "normal", fontSize: 19, margin: 0, lineHeight: 1.2,
        }}>
          {(() => {
            const row = getCatalogueData(p, catalogueId);
            const r = resolveListOfferEffective(row, priceField, p as Record<string, unknown>);
            const u = catData.priceUnit && catData.priceUnit !== "None" ? catData.priceUnit : "";
            if (r.showStrikeout) {
              return (
                <>
                  Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;{currencySymbol}{r.offerPrice}{" "}
                  <span style={STRUCK_LIST_PRICE_STYLE}>{currencySymbol}{r.listPrice}</span>
                  {u ? ` ${u}` : ""}
                </>
              );
            }
            return (
              <>Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;{currencySymbol}{r.effectiveUnitPrice || catData.price}{u ? ` ${u}` : ""}</>
            );
          })()}
        </h2>
      </div>
    </div>
  );
});

interface CatalogueViewProps {
  filtered: any[];
  allProducts: any[];
  setProducts: Dispatch<SetStateAction<any[]>>;
  selected: any[];
  setSelected: Dispatch<SetStateAction<any[]>>;
  getLighterColor: (color: string) => string;
  imageMap: Record<string, string>;
  catalogueLabel: string;
  catalogueId: string;
  priceField: string;
  priceUnitField: string;
  stockField: string;
  onBack: () => void;
  /** Shelf / deleted rows — passed through to cloud sync events so bulk stock sync matches strict mode. */
  deletedProducts?: any[];
}

export default React.memo(function CatalogueView({
  filtered,
  allProducts,
  setProducts,
  selected,
  setSelected,
  getLighterColor,
  imageMap,
  catalogueLabel,
  catalogueId,
  priceField,
  priceUnitField,
  stockField,
  onBack,
  deletedProducts = [],
}: CatalogueViewProps) {
  const { user, supabaseData } = useAuth();
  const { guardCloudWrite } = useCloudWriteGate();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  // Helper function to get catalogue-specific data for a product
  const getProductCatalogueData = useCallback((product) => {
    if (!catalogueId) return product; // Fallback to product if no catalogueId
    const catData = getCatalogueData(product, catalogueId);

    // For non-cat1/cat2 catalogues, don't fall back to wholesale/resell (those are legacy fields)
    // Only use the specific price field for this catalogue
    const isLegacyCatalogue = catalogueId === 'cat1' || catalogueId === 'cat2';

    const result: any = {
      ...product,
      // Use dynamic price field based on catalogue configuration
      // For legacy catalogues (cat1/cat2), fall back to wholesale/resell for backward compatibility
      price: catData[priceField] || product[priceField] || (isLegacyCatalogue ? product.wholesale || product.resell : "") || "",
      priceUnit: catData[priceUnitField] || product[priceUnitField] || (isLegacyCatalogue ? product.wholesaleUnit || product.resellUnit : "/ piece") || "/ piece",
    };

    // Copy all fields
    for (let i = 1; i <= 10; i++) {
      const fieldKey = `field${i}`;
      const unitKey = `field${i}Unit`;
      result[fieldKey] = catData[fieldKey] || product[fieldKey] || "";
      result[unitKey] = catData[unitKey] || product[unitKey] || "None";
    }

    return result;
  }, [catalogueId, priceField, priceUnitField]);
  
  const [stockFilter, setStockFilter] = useState(["in", "out"]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [allCategories, setAllCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  /** Synced immediately on entering selection so popstate runs before the next paint still sees truth. */
  const selectModeRef = useRef(false);
  const selectedLenRef = useRef(0);
  const onBackRef = useRef(onBack);
  selectModeRef.current = selectMode;
  selectedLenRef.current = selected.length;
  onBackRef.current = onBack;

  const [processing, setProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [processingPhase, setProcessingPhase] = useState("rendering"); // "rendering" | "loading_images" | "sharing"
  const [totalToRender, setTotalToRender] = useState(0);
  const [totalToShare, setTotalToShare] = useState(0);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef(null);
  const [showInfo, setShowInfo] = useState(true);
  const [showAddProductsModal, setShowAddProductsModal] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showShareLinkExpiryPopup, setShowShareLinkExpiryPopup] = useState(false);
  const [shareLinkExpiryPresetId, setShareLinkExpiryPresetId] = useState<ShareLinkExpiryPresetId>('24h');
  const [showWhatsAppRequiredForLink, setShowWhatsAppRequiredForLink] = useState(false);
  const [linkWhatsappDial, setLinkWhatsappDial] = useState("");
  const [linkWhatsappLocal, setLinkWhatsappLocal] = useState("");
  const [linkWhatsappError, setLinkWhatsappError] = useState("");
  const [linkWhatsappSaving, setLinkWhatsappSaving] = useState(false);

  // Touch state - moved to useRef for better performance
  const touchStateRef = useRef({
  touchTimer: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  lastMoveTime: 0,
  moved: false,
  isLongPress: false,
});

  // Drag selection state
  const dragSelectionRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    selectedDuringDrag: new Set(),
  });

  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const toolsMenuRef = useRef(null);
  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());


useEffect(() => {
  // Listen for currency changes
  const unsubscribe = onCurrencyChange((currency, symbol) => {
    setCurrencySymbol(symbol);
  });
  return unsubscribe;
}, []);

useEffect(() => {
  console.log("✅ CatalogueView: Setting up event listeners");

  // Listen for progress updates directly
  const handleRenderProgress = (event: any) => {
    const { current, total } = event.detail;
    console.log(`📊 CatalogueView renderProgress received: ${current}/${total}`);
    setProcessingIndex(current);
    setProcessingTotal(total);
  };

  // Listen for render complete to close modal
  const handleRenderComplete = () => {
    console.log("✅ CatalogueView renderComplete received");
    setProcessing(false);
  };

  // Listen for phase changes
  const handlePhaseChange = (event: any) => {
    const { phase, totalToRender, totalToShare } = event.detail;
    console.log(`📊 CatalogueView phaseChange received: ${phase}`);
    setProcessingPhase(phase);
    setTotalToRender(totalToRender);
    setTotalToShare(totalToShare);
    setProcessingIndex(0); // Reset progress when phase changes
  };

  window.addEventListener("renderProgress", handleRenderProgress);
  window.addEventListener("renderComplete", handleRenderComplete);
  window.addEventListener("processingPhaseChange", handlePhaseChange);

  console.log("✅ CatalogueView: Event listeners attached");

  return () => {
    window.removeEventListener("renderProgress", handleRenderProgress);
    window.removeEventListener("renderComplete", handleRenderComplete);
    window.removeEventListener("processingPhaseChange", handlePhaseChange);
  };
}, []);

useEffect(() => {
  if (showSearch && searchInputRef.current) {
    searchInputRef.current.focus();
  }
}, [showSearch]);


  const openPreviewHtml = (id, tab = null, filteredList = []) => {
    const evt = new CustomEvent("open-preview", {
      detail: { id, tab, filtered: filteredList },
    });
    window.dispatchEvent(evt);
  };

  useEffect(() => {
    const toggleSearch = () => setShowSearch((prev) => !prev);
    window.addEventListener("toggle-search", toggleSearch);
    return () => window.removeEventListener("toggle-search", toggleSearch);
  }, []);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("categories") || "[]");
    setAllCategories(stored);
  }, []);

  useEffect(() => {
    if (selected.length === 0) setSelectMode(false);
  }, [selected]);

  // Close tools menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target)) {
        setShowToolsMenu(false);
      }
    };

    if (showToolsMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showToolsMenu]);

  useEffect(() => {
    const handlePopState = () => {
      const inSelection =
        selectModeRef.current || selectedLenRef.current > 0;

      if (inSelection) {
        selectModeRef.current = false;
        selectedLenRef.current = 0;
        setSelectMode(false);
        setSelected([]);
        // Must run synchronously (before any await) so a second popstate in the same gesture
        // still sees the repaired stack — same pattern as Resell/Wholesale.
        window.history.pushState({ catalogueSelectionCleared: true }, "");
        try {
          void Haptics.impact({ style: ImpactStyle.Light });
        } catch (err) {
          console.warn("Haptics not supported:", err);
        }
        return;
      }

      onBackRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setSelected]);

useEffect(() => {
  // Push a fake entry to trap back
  window.history.pushState({ tab: "catalogue" }, "");
}, []);




  const toggleSelection = useCallback((id) => {
  setSelected((prev) => {
    const isRemoving = prev.includes(id);
    try {
      Haptics.impact({ style: isRemoving ? ImpactStyle.Light : ImpactStyle.Medium });
    } catch {}
    return isRemoving ? prev.filter((x) => x !== id) : [...prev, id];
  });
}, []);

  const getElementsInDragArea = useCallback((startX, startY, endX, endY) => {
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const cards = document.querySelectorAll('[data-id]');
    const elementsInArea = [];

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      // Check if card overlaps with drag area
      if (
        rect.left < maxX &&
        rect.right > minX &&
        rect.top < maxY &&
        rect.bottom > minY
      ) {
        elementsInArea.push(card.getAttribute('data-id'));
      }
    });

    return elementsInArea;
  }, []);

  const handleGridMouseDown = useCallback((e) => {
    // Store initial state for drag detection
    dragSelectionRef.current.startX = e.clientX;
    dragSelectionRef.current.startY = e.clientY;
    dragSelectionRef.current.isDragging = false;
    let longPressTimer = null;
    let hasEnteredSelectMode = selectMode;

    const handleMouseMove = (moveEvent) => {
      const dx = Math.abs(moveEvent.clientX - dragSelectionRef.current.startX);
      const dy = Math.abs(moveEvent.clientY - dragSelectionRef.current.startY);

      // Only start drag selection if moved more than 5px
      if (dx > 5 || dy > 5) {
        dragSelectionRef.current.isDragging = true;

        // If we're now dragging and not yet in select mode, enter it
        if (!hasEnteredSelectMode) {
          hasEnteredSelectMode = true;
          selectModeRef.current = true;
          setSelectMode(true);
          window.history.pushState({ select: true }, "");
        }
      }

      if (dragSelectionRef.current.isDragging) {
        const elementsInArea = getElementsInDragArea(
          dragSelectionRef.current.startX,
          dragSelectionRef.current.startY,
          moveEvent.clientX,
          moveEvent.clientY
        );

        setSelected((prev) => {
          const newSelected = new Set(prev);
          elementsInArea.forEach((id) => newSelected.add(id));
          return Array.from(newSelected);
        });
      }
    };

    const handleMouseUp = () => {
      clearTimeout(longPressTimer);
      dragSelectionRef.current.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectMode, getElementsInDragArea]);


  const visibleProducts = useMemo(() => {
  return filtered
    .filter((p) => {
      // Check if product is enabled for this specific catalogue
      const isEnabled = isProductEnabledForCatalogue(p, catalogueId);
      if (!isEnabled) return false;

      // Use the catalogue's stockField instead of hardcoded field
      const productStock = p[stockField];
      const matchesStock =
        (stockFilter.includes("in") && productStock) ||
        (stockFilter.includes("out") && !productStock);
      const matchesCategory =
        categoryFilter === "" ||
        (Array.isArray(p.category)
          ? p.category.includes(categoryFilter)
          : p.category === categoryFilter);
      const matchesSearch =
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.subtitle?.toLowerCase().includes(search.toLowerCase());
      return matchesStock && matchesCategory && matchesSearch;
    });
}, [filtered, stockFilter, categoryFilter, search, catalogueId, stockField]);


  // Memoized touch handlers for better performance
  const handleTouchStart = useCallback((e, id) => {
  touchStateRef.current.moved = false;
  touchStateRef.current.isLongPress = false;
  const touch = e.touches?.[0] || e;
  touchStateRef.current.startX = touch.clientX;
  touchStateRef.current.startY = touch.clientY;
  touchStateRef.current.lastX = touch.clientX;
  touchStateRef.current.lastY = touch.clientY;
  touchStateRef.current.lastMoveTime = Date.now();

  touchStateRef.current.touchTimer = setTimeout(() => {
    if (!touchStateRef.current.moved) {
      if (!selectModeRef.current) {
        window.history.pushState({ select: true }, "");
        selectModeRef.current = true;
        setSelectMode(true);
      }
      touchStateRef.current.isLongPress = true;
      setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
      try { Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    }
  }, 600);
}, []);

const handleTouchMove = useCallback((e) => {
  const touch = e.touches?.[0] || e;
  const now = Date.now();

  const dx = Math.abs(touch.clientX - touchStateRef.current.startX);
  const dy = Math.abs(touch.clientY - touchStateRef.current.startY);

  const timeDelta = now - (touchStateRef.current.lastMoveTime || now);
  const stepDx = Math.abs(touch.clientX - (touchStateRef.current.lastX || touch.clientX));
  const stepDy = Math.abs(touch.clientY - (touchStateRef.current.lastY || touch.clientY));
  const velocity = timeDelta > 0 ? (stepDx + stepDy) / timeDelta : 0;

  touchStateRef.current.lastX = touch.clientX;
  touchStateRef.current.lastY = touch.clientY;
  touchStateRef.current.lastMoveTime = now;

  // Cancel long press if: distance > 4px OR velocity > 0.1px/ms
  if (!touchStateRef.current.isLongPress && (dx > 4 || dy > 4 || velocity > 0.1)) {
    touchStateRef.current.moved = true;
    clearTimeout(touchStateRef.current.touchTimer);
  } else if (touchStateRef.current.isLongPress) {
    // Already in long press — do drag selection
    e.preventDefault?.();
    const elementsInArea = getElementsInDragArea(
      touchStateRef.current.startX,
      touchStateRef.current.startY,
      touch.clientX,
      touch.clientY
    );
    setSelected((prev) => {
      const newSelected = new Set(prev);
      elementsInArea.forEach((elemId) => newSelected.add(elemId));
      return Array.from(newSelected);
    });
  }
}, [getElementsInDragArea]);

const handleTouchEnd = useCallback(() => {
  clearTimeout(touchStateRef.current.touchTimer);
  touchStateRef.current.isLongPress = false;
}, []);

  const handleCardClick = useCallback((id) => {
    // Don't toggle selection if we just finished dragging
    if (dragSelectionRef.current.isDragging || touchStateRef.current.isLongPress) {
      return;
    }

    if (selectMode) {
      toggleSelection(id);
    } else {
      openPreviewHtml(id, catalogueId, visibleProducts);
    }
  }, [selectMode, catalogueId, visibleProducts]);

  const handleDownload = async (e, productId, productName) => {
    e.stopPropagation();
    try {
      // Find the product card by data-id
      const cardElement = document.querySelector(`[data-id="${productId}"]`);
      if (!cardElement) {
        console.error('Product card not found');
        return;
      }

      // Get just the image area (first div with relative aspect-square)
      const imageArea = cardElement.querySelector('.relative.aspect-square');
      if (!imageArea) {
        console.error('Image area not found');
        return;
      }

      // Create a temporary container to capture the element
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = 'auto';
      tempContainer.style.zIndex = '-1';

      // Clone the image area to avoid modifying the original
      const clonedElement = imageArea.cloneNode(true) as HTMLElement;
      clonedElement.style.display = 'block';
      clonedElement.style.margin = '0';
      clonedElement.style.padding = '0';
      clonedElement.style.width = '400px';
      clonedElement.style.height = '400px';

      tempContainer.appendChild(clonedElement);
      document.body.appendChild(tempContainer);

      // Wait for images to load
      const images = clonedElement.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          return new Promise((resolve) => {
            if (img.complete) {
              resolve(null);
            } else {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }
          });
        })
      );

      // Use Canvas API to capture the rendered element
      const canvas = await renderElementToCanvas(clonedElement, {
        backgroundColor: '#ffffff',
        scale: 3,
        width: 400,
        height: 400,
      });

      // Convert canvas to blob
      const blob = await canvasToBlob(canvas);
      if (!blob) {
        console.error('Failed to create image blob');
        document.body.removeChild(tempContainer);
        return;
      }

      const filename = `${productName || 'product'}_${productId}.png`;

      // Use FileSaver or Filesystem API for download
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'Image', accept: { 'image/png': ['.png'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Save file picker failed, trying download:', err);
            // Fallback to blob download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }
      } else {
        // Fallback: simple blob download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Clean up temporary container
      document.body.removeChild(tempContainer);
      // Release canvas memory
      canvas.width = 0;
      canvas.height = 0;
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleGeneratePDF = async (actionType: 'share' | 'download') => {
    try {
      if (!selected || selected.length === 0) {
        alert("No products selected.");
        return;
      }

      if (!isPro && !canConsumePdfToday(user?.uid, isPro)) {
        alert(
          "Daily PDF limit reached for the Free plan (1 per day). Try again tomorrow, or upgrade to Pro for unlimited PDFs."
        );
        return;
      }

      if (selected.length > 80) {
        const confirmed = window.confirm(
          `You have selected ${selected.length} products. Generating a PDF with more than 80 images may make the app unstable. Do you want to continue?`
        );
        if (!confirmed) return;
      }

      setProcessing(true);
      setProcessingPhase("loading_images");
      setProcessingIndex(0);
      setProcessingTotal(selected.length);

      // Get selected products with their data
      const selectedProducts = allProducts
        .filter(p => selected.includes(p.id))
        .map(product => {
          const catalogueData = getProductCatalogueData(product);

          // Get the image data - try to get base64 from product.image or imageMap
          let imageData = product.image;
          if (!imageData && product.id && imageMap[product.id]) {
            imageData = imageMap[product.id];
          }

          const catRow = getCatalogueData(product, catalogueId);
          const offerR = resolveListOfferEffective(catRow, priceField, product as Record<string, unknown>);
          return {
            id: product.id,
            name: product.name || "Unnamed Product",
            subtitle: product.subtitle || "",
            image: imageData,
            price: offerR.showStrikeout ? offerR.listPrice : catalogueData.price,
            offerPrice: offerR.showStrikeout ? offerR.offerPrice : undefined,
            priceUnit: catalogueData.priceUnit,
            field1: catalogueData.field1,
            field2: catalogueData.field2,
            field3: catalogueData.field3,
            field4: catalogueData.field4,
            field5: catalogueData.field5,
            field6: catalogueData.field6,
            field7: catalogueData.field7,
            field8: catalogueData.field8,
            field9: catalogueData.field9,
            field10: catalogueData.field10,
            field1Unit: catalogueData.field1Unit,
            field2Unit: catalogueData.field2Unit,
            field3Unit: catalogueData.field3Unit,
            field4Unit: catalogueData.field4Unit,
            field5Unit: catalogueData.field5Unit,
            field6Unit: catalogueData.field6Unit,
            field7Unit: catalogueData.field7Unit,
            field8Unit: catalogueData.field8Unit,
            field9Unit: catalogueData.field9Unit,
            field10Unit: catalogueData.field10Unit,
            ...(getProductVariantGroups(product).length > 0
              ? { variantGroups: getProductVariantGroups(product) }
              : {}),
          };
        });

      const productsForPdf = await prepareSelectedProductsForPdfExport(
        selectedProducts,
        allProducts,
        (loaded, total) => {
          setProcessingIndex(loaded);
          setProcessingTotal(total);
        }
      );

      // Get field labels for PDF
      const allFields = getAllFields();
      const fieldLabels: { [key: string]: string } = {};
      allFields.forEach(field => {
        if (field.enabled && field.key.startsWith('field')) {
          fieldLabels[field.key] = field.label;
        }
      });

      // Generate PDF (header + footer use Account company details, not catalogue name / date)
      setProcessingPhase("sharing");
      const businessProfile = getBusinessProfileForPdf(supabaseData?.userSettings);
      const pdfBlob = await generateProductPDF({
        products: productsForPdf,
        catalogueName: catalogueLabel,
        businessProfile,
        currencySymbol,
        fieldLabels,
      });

      if (!isPro) {
        recordPdfConsumption(user?.uid);
      }

      setProcessing(false);
      setShowToolsMenu(false);

      const filePrefix = pdfFilenamePrefix(businessProfile, catalogueLabel);
      const filename = `${filePrefix}_products_${new Date().getTime()}.pdf`;
      const shareTitle =
        businessProfile.businessName?.trim() ||
        `${catalogueLabel} products`;

      if (actionType === 'download') {
        downloadPDF(pdfBlob, filename);
      } else {
        await sharePDF(pdfBlob, filename, `Share ${shareTitle}`);
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      setProcessing(false);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  useEffect(() => {
    const toggleFilterHandler = () => setShowFilters((prev) => !prev);
    window.addEventListener("toggle-catalogue-filter", toggleFilterHandler);
    return () => window.removeEventListener("toggle-catalogue-filter", toggleFilterHandler);
  }, []);

  useEffect(() => {
    if (!showWhatsAppRequiredForLink) return;
    const saved = localStorage.getItem("whatsappNumber") || "";
    const parsed = parseWhatsAppNumber(saved);
    setLinkWhatsappDial(parsed.dial);
    setLinkWhatsappLocal(parsed.local);
    setLinkWhatsappError("");
  }, [showWhatsAppRequiredForLink]);

  const handleLinkWhatsappDialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setLinkWhatsappDial(raw.trim() === "+" ? "+" : "");
      return;
    }
    setLinkWhatsappDial(`+${digits}`);
  };

  const runOrderFormShareFlow = useCallback(
    async (sellerWhatsapp: string) => {
      if (!user?.uid) return;
      if (!isPro && !canCreateShareLinkToday(user.uid, isPro)) {
        alert(
          "Daily share-link limit reached for the Free plan (1 per day). Try again tomorrow, or upgrade to Pro for unlimited links."
        );
        return;
      }
      try {
        setShowShareOptions(false);

        const selectedProducts = allProducts.filter((p) => selected.includes(p.id));
        const items = selectedProducts.map((p) => productToShareLinkItem(p, catalogueId));

        const biz = businessProfileFromUserSettings(supabaseData?.userSettings);
        const sellerBusinessName = biz.businessName?.trim() || undefined;
        const sellerLogoUrl = biz.logoUrl?.trim() || undefined;

        const { code: sellerCurrencyCode, symbol: sellerCurrencySymbol } =
          getSellerCurrencyForShareLink(supabaseData?.userSettings);

        const expiresInDays =
          SHARE_LINK_EXPIRY_PRESETS.find((p) => p.id === shareLinkExpiryPresetId)?.expiresInDays ?? 1;

        const { url } = await createShareLink({
          sellerUserId: user.uid,
          sellerWhatsapp,
          items,
          sellerBusinessName,
          sellerCurrencyCode,
          sellerCurrencySymbol,
          sellerLogoUrl,
          expiresInDays,
        });

        if (!isPro) {
          recordShareLinkConsumption(user.uid);
        }

        const shareMessage = `Order using the link ${url}`;

        let shared = false;
        try {
          const { Capacitor } = await import("@capacitor/core");
          if (Capacitor.isNativePlatform()) {
            const { Share } = await import("@capacitor/share");
            await Share.share({
              title: "Order Link",
              text: shareMessage,
              dialogTitle: "Share order link",
            });
            shared = true;
          }
        } catch (shareErr: any) {
          if (shareErr?.name !== "AbortError") {
            console.warn("Capacitor share failed, trying web share:", shareErr);
          } else {
            shared = true;
          }
        }

        if (!shared && navigator.share) {
          try {
            await navigator.share({ title: "Order Link", text: shareMessage });
            shared = true;
          } catch (shareErr: any) {
            if (!(shareErr.name === "AbortError" || shareErr.name === "NotAllowedError")) {
              console.error("Web share failed:", shareErr);
            } else {
              shared = true;
            }
          }
        }

        if (!shared) {
          try {
            await navigator.clipboard.writeText(shareMessage);
            alert("Order link copied to clipboard for sharing.");
          } catch {
            // Clipboard copy failed; silently continue.
          }
        }
      } catch (err: any) {
        console.error("Failed to create order form link:", err);
        const msg = typeof err?.message === "string" ? err.message : String(err);
        const hint =
          /row-level security|rls|permission denied|42501/i.test(msg)
            ? " Sign in again, or ask an admin to check Supabase policies on share_links."
            : /column|schema cache|pgrst/i.test(msg)
              ? " Run the latest SQL in SUPABASE_SHARE_LINKS_SQL.md (currency columns + get_share_link)."
              : "";
        alert(
          msg && msg.length < 200
            ? `Could not create link: ${msg}${hint ? `\n\n${hint}` : ""}`
            : `Could not create link.${hint ? ` ${hint}` : " Please try again."}`
        );
      }
    },
    [user, supabaseData, allProducts, selected, catalogueId, isPro, shareLinkExpiryPresetId]
  );

  const saveWhatsAppFromLinkModal = async () => {
    setLinkWhatsappError("");
    const dialDigits = linkWhatsappDial.replace(/\D/g, "");
    if (!dialDigits) {
      setLinkWhatsappError("Enter country code (e.g. +91).");
      return;
    }
    const local = (linkWhatsappLocal || "").replace(/\D/g, "");
    if (!local) {
      setLinkWhatsappError("Enter your WhatsApp number.");
      return;
    }
    const clean = `+${dialDigits}${local}`;
    setLinkWhatsappSaving(true);
    try {
      localStorage.setItem("whatsappNumber", clean);
      window.dispatchEvent(new CustomEvent("whatsappNumberLocalStorageUpdated"));
      setShowWhatsAppRequiredForLink(false);
      await runOrderFormShareFlow(clean);
    } finally {
      setLinkWhatsappSaving(false);
    }
  };

  useEffect(() => {
    const container = document.getElementById("catalogue-header-icons");
    if (!container) return;
    container.innerHTML = "";

    const filterBtn = document.createElement("button");
    filterBtn.className = "text-gray-600 hover:text-black";
    filterBtn.innerHTML = `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M3 4h18M3 10h18M6 16h12' /></svg>`;
    filterBtn.onclick = () => setShowFilters(true);
    container.appendChild(filterBtn);

    if (selectMode) {
      const count = document.createElement("span");
      count.className = "text-xs bg-red-500 text-white rounded-full px-1";
      count.innerText = selected.length.toString();
      container.appendChild(count);

      const shareBtn = document.createElement("button");
      shareBtn.className = "text-green-600 hover:text-green-800 ml-2";
      shareBtn.innerHTML = `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M16.5 12a4.5 4.5 0 01-9 0m9 0A4.5 4.5 0 007.5 12m9 0V5.25M7.5 12V5.25m0 0h9' /></svg>`;
      shareBtn.onclick = async () => {
        await handleShare({
          selected,
          setProcessing,
          setProcessingIndex,
          setProcessingTotal,
          folder: catalogueLabel,
          mode: catalogueId,
          products: allProducts,
        });
      };
      container.appendChild(shareBtn);

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "ml-2 text-sm text-gray-600 hover:text-black";
      toggleBtn.innerHTML =
        selected.length === visibleProducts.length
          ? `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M4 6h16M4 12h16M4 18h16' /></svg>`
          : `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M5 13l4 4L19 7' /></svg>`;
      toggleBtn.title = selected.length === visibleProducts.length ? "Deselect All" : "Select All";
      toggleBtn.onclick = () =>
        setSelected(
          selected.length === visibleProducts.length
            ? []
            : visibleProducts.map((p) => p.id)
        );
      container.appendChild(toggleBtn);
    }
  }, [selectMode, selected, visibleProducts]);

  return (
    <>
    <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center gap-3 px-4 relative">
  {/* Back/Close button that animates between arrow and X */}
  {!showSearch && onBack && (
    <motion.button
      onClick={() => {
        // Trigger history back, which will be handled by the popstate listener
        // to either deselect products or exit the catalogue view
        window.history.back();
      }}
      className="relative w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors"
      title={selectMode ? "Exit Selection" : "Back"}
    >
      {/* Arrow (visible when not in selectMode) */}
      <motion.svg
        className="w-5 h-5 absolute"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        initial={false}
        animate={{
          opacity: selectMode ? 0 : 1,
          scale: selectMode ? 0.5 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </motion.svg>

      {/* X icon (visible when in selectMode) */}
      <motion.span
        className="absolute w-6 h-0.5 bg-gray-700"
        initial={false}
        animate={{
          rotate: selectMode ? 45 : 0,
          opacity: selectMode ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
      />
      <motion.span
        className="absolute w-6 h-0.5 bg-gray-700"
        initial={false}
        animate={{
          rotate: selectMode ? -45 : 0,
          opacity: selectMode ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  )}

  {/* Center Title (hidden while searching or in selectMode) */}
  {!showSearch && !selectMode && (
    <div className="flex items-center gap-2">
      <h1
    className="text-xl sm:text-lg md:text-xl font-bold cursor-pointer transition-opacity duration-200 truncate whitespace-nowrap"
    onClick={() => {
      // Already not in selectMode, no need to back
    }}
    style={{ maxWidth: "50vw" }}
  >
    {catalogueLabel || "Catalogue"}
  </h1>
    </div>
  )}

  {/* Expanding Search Box (inline, smooth, fixed) */}
  <div className="flex-1" />
  <div
    className={`transition-all duration-300 flex items-center overflow-hidden ${
      showSearch ? "w-80 opacity-100 scale-100" : "w-0 opacity-0 scale-95"
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

  {/* Fixed Icons: Search, Filter, Share etc. */}
  <div className="relative flex items-center gap-2 shrink-0 ml-2 ml-auto">
    {/* Search Toggle Button */}
    <button
      onClick={() => setShowSearch((prev) => !prev)}
      className="text-xl text-gray-600 hover:text-black"
      title="Search"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M16.5 16.5A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012 12z"
        />
      </svg>
    </button>

    <button
  onClick={() => setShowInfo((prev) => !prev)}
  className="text-gray-600 hover:text-black p-1"
  title={showInfo ? "Hide Info" : "Show Info"}
>
  {showInfo ? (
    // Eye (visible)
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    // Eye Off (hidden)
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.269-2.943-9.543-7a10.05 10.05 0 012.852-4.41M9.88 9.88a3 3 0 104.24 4.24" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  )}
</button>

    {/* Select/Share buttons when in selectMode */}
    {selectMode && (
      <>      
        <button
          onClick={() =>
            setSelected(
              selected.length === visibleProducts.length
                ? []
                : visibleProducts.map((p) => p.id)
            )
          }
          className="text-gray-600 hover:text-black"
          title={selected.length === visibleProducts.length ? "Deselect All" : "Select All"}
        >
          {selected.length === visibleProducts.length ? (
    // Deselect (X mark)
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
    >
      <g>
        <rect x="5" y="5" width="14" height="14" rx="2" ry="2" fill="gray" />
        <rect x="3" y="3" width="14" height="14" rx="2" ry="2" fill="gray" opacity="0.7" />
        <rect x="1" y="1" width="14" height="14" rx="2" ry="2" fill="gray" opacity="0.4" />
        <path
           d="M10 10 L14 14 M14 10 L10 14"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  ) : (
    // Select (✓ mark)
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
    >
      <g>
        <rect x="5" y="5" width="14" height="14" rx="2" ry="2" fill="gray" />
        <rect x="3" y="3" width="14" height="14" rx="2" ry="2" fill="gray" opacity="0.7" />
        <rect x="1" y="1" width="14" height="14" rx="2" ry="2" fill="gray" opacity="0.4" />
        <path
          d="M8.5 12.5l2 2 5-5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )}
        </button>



        <span className="ml-2 text-[11px] px-2.5 py-1 bg-red-500 text-white font-semibold rounded-2xl shadow-md relative before:content-[''] before:absolute before:-left-1 before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-red-500">
  {selected.length}
</span>
<button
  onClick={() => {
    setShowShareOptions(true);
  }}
  className="w-9 h-9 flex items-center justify-center rounded-md text-green-600 hover:text-green-700 transition-colors"
  title="Share"
>
  <svg
    className="w-[20px] h-[20px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M22 2L11 13"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M22 2L15 22L11 13L2 9L22 2Z"
    />
  </svg>
</button>


      </>
    )}

    {/* Tools Menu Button (3 dots) - Always on the right */}
    <div className="relative ml-auto" ref={toolsMenuRef}>
      <button
        onClick={() => setShowToolsMenu((prev) => !prev)}
        className="text-xl text-gray-600 hover:text-black p-1"
        title="More options"
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showToolsMenu && (
        <div className="absolute right-0 top-10 z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-max py-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowBulkEdit(true);
              setShowToolsMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            title="Bulk Edit"
          >
            <RiEdit2Line className="w-4 h-4" />
            Bulk Edit
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFilters(true);
              setShowToolsMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            title="Filter"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 10h12M10 15h4" />
            </svg>
            Filter
          </button>

          <div className="border-t border-gray-200 my-1" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEdit((prev) => !prev);
              setShowToolsMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
            title={showEdit ? "Hide Edit Icons" : "Show Edit Icons"}
          >
            <FiEdit className="w-4 h-4" />
            {showEdit ? "Hide Edit" : "Show Edit"}
          </button>

          {selectMode && (
            <>
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!guardCloudWrite()) return;
                  console.log('🟢 Mark as In Stock clicked for', selected.length, 'products');
                  const allProds = allProducts;
                  const updated = allProds.map((p) =>
                    selected.includes(p.id) ? { ...p, [stockField]: true } : p
                  );
                  console.log('📝 Updated products with stockField:', stockField, '=', updated.filter(p => selected.includes(p.id)).map(p => ({ name: p.name, [stockField]: p[stockField] })));
                  setProducts(updated);
                  // Save to localStorage before dispatching event to prevent listener from restoring stale data
                  // Use user-scoped key if logged in, otherwise use default key
                  const storageKey = user?.uid ? `products::${user.uid}` : 'products';
                  localStorage.setItem(storageKey, JSON.stringify(updated));
                  // Cloud sync: use only sync-to-supabase (1s overlay via App). Do not also fire product-added
                  // strict sync — that path runs syncProductsToCloud without maxSyncUiMs and blocks the UI longer.
                  window.dispatchEvent(
                    new CustomEvent("sync-to-supabase", {
                      detail: { products: updated, deletedProducts },
                    })
                  );
                  console.log('✅ sync-to-supabase dispatched (bulk in stock)');
                  setShowToolsMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                title="Mark as In Stock"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                Mark as In Stock
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!guardCloudWrite()) return;
                  console.log('🔴 Mark as Out of Stock clicked for', selected.length, 'products');
                  const allProds = allProducts;
                  const updated = allProds.map((p) =>
                    selected.includes(p.id) ? { ...p, [stockField]: false } : p
                  );
                  console.log('📝 Updated products with stockField:', stockField, '=', updated.filter(p => selected.includes(p.id)).map(p => ({ name: p.name, [stockField]: p[stockField] })));
                  setProducts(updated);
                  // Save to localStorage before dispatching event to prevent listener from restoring stale data
                  // Use user-scoped key if logged in, otherwise use default key
                  const storageKey = user?.uid ? `products::${user.uid}` : 'products';
                  localStorage.setItem(storageKey, JSON.stringify(updated));
                  window.dispatchEvent(
                    new CustomEvent("sync-to-supabase", {
                      detail: { products: updated, deletedProducts },
                    })
                  );
                  console.log('✅ sync-to-supabase dispatched (bulk out of stock)');
                  setShowToolsMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                title="Mark as Out of Stock"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
                Mark as Out of Stock
              </button>
            </>
          )}
        </div>
      )}
    </div>
  </div>
</header>




     {/* Modern Filter Drawer Slide-In */}
<div
  className={`fixed inset-0 z-40 transition duration-300 ${
    showFilters ? "opacity-100" : "opacity-0 pointer-events-none"
  }`}
>
  {/* Backdrop */}
<div
  className="absolute inset-0 z-0 bg-black/90"
  style={{
    opacity: showFilters ? 1 : 0,
    transition: "opacity 300ms ease",
    pointerEvents: showFilters ? "auto" : "none",
  }}
  onClick={() => setShowFilters(false)}
></div>


  {/* Bottom Sheet */}
  <div
    className={`absolute bottom-0 left-0 right-0 w-full max-w-xl mx-auto bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ${
      showFilters ? "translate-y-0" : "translate-y-full"
    }`}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="px-5 py-4">
      {/* Pull handle */}
      <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-gray-800">Filter</h3>
        <button
          onClick={() => setShowFilters(false)}
          className="text-gray-500 text-xl font-light"
        >
          &times;
        </button>
      </div>

      {/* Stock Toggle */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Stock</label>
        <div className="flex gap-2">
          {["in", "out"].map((type) => (
            <button
              key={type}
              onClick={() =>
                setStockFilter((prev) =>
                  prev.includes(type)
                    ? prev.filter((v) => v !== type)
                    : [...prev, type]
                )
              }
              className={`px-3 py-1 rounded-full text-sm font-medium border ${
                stockFilter.includes(type)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-100 text-gray-700 border-gray-300"
              }`}
            >
              {type === "in" ? "In Stock" : "Out of Stock"}
            </button>
          ))}
        </div>
      </div>

      {/* Category Select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
        >
          <option value="">All Categories</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  </div>
</div>

     {/* Share Options Popup */}
<AnimatePresence>
  {showShareOptions && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setShowShareOptions(false)}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="relative w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="text-center mb-8">
            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-2">
              Share Selection
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">
              {catalogueLabel}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
              {selected.length} {selected.length === 1 ? 'item' : 'items'} ready to share
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={async () => {
                setShowShareOptions(false);
                await handleShare({
                  selected,
                  setProcessing,
                  setProcessingIndex,
                  setProcessingTotal,
                  folder: catalogueLabel,
                  mode: catalogueId,
                  products: allProducts,
                });
              }}
              className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/50 group"
            >
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 rotate-6 group-hover:rotate-0 transition-transform">
                <FiImage size={22} className="-rotate-6 group-hover:rotate-0 transition-transform" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-slate-900 dark:text-white text-xs">Images</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-1">Quick Share</span>
              </div>
            </button>

            <button
              onClick={() => {
                setShowShareOptions(false);
                if (!isPro) {
                  navigate("/settings/pro");
                  return;
                }
                handleGeneratePDF('share');
              }}
              className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/50 group"
            >
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/20 -rotate-6 group-hover:rotate-0 transition-transform">
                <FaRegFilePdf size={22} className="rotate-6 group-hover:rotate-0 transition-transform" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-slate-900 dark:text-white text-xs">PDF Doc</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-1">Client Ready</span>
              </div>
            </button>

            <button
              onClick={() => {
                if (!user?.uid) {
                  setShowShareOptions(false);
                  alert("Please login first.");
                  return;
                }
                setShowShareOptions(false);
                setShareLinkExpiryPresetId('24h');
                setShowShareLinkExpiryPopup(true);
              }}
              className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/50 group"
            >
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/20 rotate-6 group-hover:rotate-0 transition-transform">
                <FiLink size={22} className="-rotate-6 group-hover:rotate-0 transition-transform" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-slate-900 dark:text-white text-xs">Link</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-1">Order Form</span>
              </div>
            </button>
          </div>

          <button
            onClick={() => setShowShareOptions(false)}
            className="mt-8 w-full py-2 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>

  {/* Order link expiry — opens after user taps Link in Share Selection */}
  <AnimatePresence>
    {showShareLinkExpiryPopup && (
      <div className="fixed inset-0 z-[105] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setShowShareLinkExpiryPopup(false);
            setShowShareOptions(true);
          }}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden p-5 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-green-500/15 dark:bg-green-500/20 flex items-center justify-center">
              <FiLink className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                Link expiry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                How long should the order link stay active?
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {SHARE_LINK_EXPIRY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setShareLinkExpiryPresetId(preset.id)}
                className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors border ${
                  shareLinkExpiryPresetId === preset.id
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-green-400/60'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                setShowShareLinkExpiryPopup(false);
                const sellerWhatsapp =
                  localStorage.getItem("whatsappNumber") ||
                  supabaseData?.userSettings?.whatsapp_number ||
                  supabaseData?.userSettings?.whatsappNumber ||
                  "";
                if (!String(sellerWhatsapp).trim()) {
                  setShowWhatsAppRequiredForLink(true);
                  return;
                }
                await runOrderFormShareFlow(String(sellerWhatsapp).trim());
              }}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors touch-manipulation"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setShowShareLinkExpiryPopup(false);
                setShowShareOptions(true);
              }}
              className="w-full py-2.5 rounded-xl text-slate-500 dark:text-slate-400 font-semibold text-sm hover:text-slate-700 dark:hover:text-slate-200 transition-colors touch-manipulation"
            >
              Back
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* WhatsApp input — required for order link (saved locally only) */}
  <AnimatePresence>
    {showWhatsAppRequiredForLink && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !linkWhatsappSaving && setShowWhatsAppRequiredForLink(false)}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden p-5 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-green-500/15 dark:bg-green-500/20 flex items-center justify-center">
              <FiMessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                WhatsApp number needed to share as link
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Saved on this device only — same as Account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0 mb-2">
            <input
              type="text"
              inputMode="tel"
              autoComplete="tel-country-code"
              aria-label="Country code"
              value={linkWhatsappDial}
              onChange={handleLinkWhatsappDialChange}
              disabled={linkWhatsappSaving}
              placeholder="+91"
              className="w-[7rem] shrink-0 px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-base font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:opacity-60"
            />
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              aria-label="Mobile number"
              value={linkWhatsappLocal}
              onChange={(e) => setLinkWhatsappLocal(e.target.value.replace(/\D/g, ""))}
              disabled={linkWhatsappSaving}
              placeholder="98XXXXXXXX"
              className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-base tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:opacity-60"
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
            Example: <span className="font-mono text-slate-500 dark:text-slate-400">+91 9876543210</span>
          </p>
          {linkWhatsappError ? (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{linkWhatsappError}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void saveWhatsAppFromLinkModal()}
              disabled={linkWhatsappSaving}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors touch-manipulation disabled:opacity-50 disabled:pointer-events-none"
            >
              {linkWhatsappSaving ? "Saving…" : "Save & create link"}
            </button>
            <button
              type="button"
              disabled={linkWhatsappSaving}
              onClick={() => setShowWhatsAppRequiredForLink(false)}
              className="w-full py-2.5 rounded-xl text-slate-500 dark:text-slate-400 font-semibold text-sm hover:text-slate-700 dark:hover:text-slate-200 transition-colors touch-manipulation disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

    

<div className="px-0 pb-28 pt-10">
      {/* Grid */}
      <div
        id="capture-area"
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 select-none"
        onMouseDown={handleGridMouseDown}
      >
        {visibleProducts.map((p) => (
  <ProductCard
    key={p.id}
    p={p}
    isSelected={selected.includes(p.id)}
    stockField={stockField}
    showEdit={showEdit}
    showInfo={showInfo}
    currencySymbol={currencySymbol}
    imageMap={imageMap}
    catalogueId={catalogueId}
    priceField={priceField}
    getLighterColor={getLighterColor}
    getProductCatalogueData={getProductCatalogueData}
    onCardClick={handleCardClick}
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
    onMouseUp={handleTouchEnd}
    onMouseLeave={handleTouchEnd}
  />
))}
      </div>
      {processing && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-xl px-6 py-4 text-center animate-fadeIn space-y-4 w-80 max-w-[90vw]">
      {/* Title with phase indicator */}
      <div className="space-y-1">
        <div className="text-lg font-semibold text-gray-700">
          {processingPhase === "rendering"
            ? "🖼️ Rendering Images"
            : processingPhase === "loading_images"
              ? "📷 Loading photos for PDF"
              : "📦 Preparing Files"}
        </div>
        <div className="text-sm text-gray-500">
          {processingPhase === "rendering"
            ? `Image ${processingIndex} of ${processingTotal}`
            : processingPhase === "loading_images"
              ? processingIndex === 0
                ? `Preparing ${processingTotal} photo${processingTotal !== 1 ? "s" : ""}…`
                : `Loaded ${processingIndex} of ${processingTotal}`
              : `Fetching ${processingIndex} of ${processingTotal}`}
        </div>
      </div>

      {/* Rendering or PDF image preload progress */}
      {((processingPhase === "rendering" && totalToRender > 0) || processingPhase === "loading_images") && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-blue-500 transition-all duration-200 ease-out relative"
              style={{
                width: `${processingTotal > 0 ? (processingIndex / processingTotal) * 100 : 0}%`,
                willChange: 'width',
              }}
            >
              <div
                className="absolute inset-0 w-full h-full animate-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%'
                }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-600">
            {processingTotal > 0 ? Math.round((processingIndex / processingTotal) * 100) : 0}% complete
          </div>
        </div>
      )}

      {/* Sharing Phase Progress */}
      {processingPhase === "sharing" && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-green-500 transition-all duration-200 ease-out relative"
              style={{
                width: `${processingTotal > 0 ? (processingIndex / processingTotal) * 100 : 0}%`,
                willChange: 'width',
              }}
            >
              <div
                className="absolute inset-0 w-full h-full animate-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%'
                }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-600">
            {processingTotal > 0 ? Math.round((processingIndex / processingTotal) * 100) : 0}% complete
          </div>
        </div>
      )}

      {/* Info Section - Show rendering details (not during PDF photo preload) */}
      {totalToRender > 0 && processingPhase === "rendering" && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 space-y-1 border border-blue-100">
          <div className="text-xs font-semibold text-blue-900">
            💡 First-time rendering
          </div>
          <div className="text-xs text-blue-800 leading-relaxed">
            {totalToRender} image{totalToRender !== 1 ? 's' : ''} need rendering. This is a one-time process that makes future shares instant.
          </div>
          <div className="text-xs text-blue-700 font-medium pt-1">
            Tip: Render all images at once to avoid waiting multiple times
          </div>
        </div>
      )}

      {/* Info Section - All cached */}
      {totalToRender === 0 && processingPhase === "sharing" && (
        <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-100">
          <div className="text-xs font-semibold text-green-900">
            ⚡ All images cached
          </div>
          <div className="text-xs text-green-800">
            Ready to share instantly!
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 pt-1">Please wait…</div>
    </div>
  </div>
)}

      <AddProductsModal
        isOpen={showAddProductsModal}
        onClose={() => setShowAddProductsModal(false)}
        catalogueId={catalogueId}
        catalogueLabel={catalogueLabel}
        allProducts={allProducts}
        imageMap={imageMap}
        onProductsUpdate={setProducts}
      />

      {showBulkEdit && (
        <BulkEdit
          products={visibleProducts}
          allProducts={allProducts}
          imageMap={imageMap}
          setProducts={setProducts}
          onClose={() => setShowBulkEdit(false)}
          triggerRender={() => {}}
          catalogueId={catalogueId}
          priceField={priceField}
          priceUnitField={priceUnitField}
          stockField={stockField}
          setShowAddProductsModal={setShowAddProductsModal}
        />
      )}
    </div>

    {/* Floating Add Button */}
    <button
      onClick={() => setShowAddProductsModal(true)}
      className="fixed right-4 z-20 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-300 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-400 shadow-sm hover:shadow-md transition-all"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      title="Add products to this catalogue"
    >
      <FiPlus size={20} />
      <span className="text-sm font-medium">Add</span>
    </button>
    </>
  );
});
