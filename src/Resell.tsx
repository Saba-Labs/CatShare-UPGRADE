// updated with raw SVG icons for proper innerHTML rendering
import React, { useState, useMemo, useEffect, useRef } from "react";
import { handleShare } from "./Share";
import { HiCheck } from "react-icons/hi";
import { FiPlus, FiEdit } from "react-icons/fi";
import { MdLayers } from "react-icons/md";
import { RiEdit2Line } from "react-icons/ri";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { renderElementToCanvas, canvasToBlob } from "./utils/canvasRenderer";
import { AnimatePresence, motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App } from "@capacitor/app";
import { getCatalogueData, isProductEnabledForCatalogue, setCatalogueData } from "./config/catalogueProductUtils";
import { saveProducts } from "./config/productUtils";
import { getFieldConfig, getAllFields } from "./config/fieldConfig";
import AddProductsModal from "./components/AddProductsModal";
import BulkEdit from "./BulkEdit";
import { getCurrentCurrencySymbol, onCurrencyChange } from "./utils/currencyUtils";
import { useCloudWriteGate } from "./hooks/useCloudWriteGate";
import { resolveListOfferEffective, STRUCK_LIST_PRICE_STYLE } from "./utils/offerPriceUtils";


export default function ResellTab({
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
}) {
  const { guardCloudWrite } = useCloudWriteGate();
  // Helper function to get catalogue-specific data for a product
  const getProductCatalogueData = (product) => {
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
  };

  const [stockFilter, setStockFilter] = useState(["in", "out"]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [allCategories, setAllCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showAddProductsModal, setShowAddProductsModal] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());

  useEffect(() => {
    // Listen for currency changes
    const unsubscribe = onCurrencyChange((currency, symbol) => {
      setCurrencySymbol(symbol);
    });
    return unsubscribe;
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

  useEffect(() => {
  const handlePopState = async () => {
    if (selectMode) {
      setSelectMode(false);
      setSelected([]);
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (err) {
        console.warn("Haptics not supported:", err);
      }

      // Re-push fake screen again so future back gestures work
      window.history.pushState({ select: true }, "");
    }
  };

  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, [selectMode]);

useEffect(() => {
  // Push a fake entry to trap back
  window.history.pushState({ tab: "catalogue2" }, "");
}, []);




  const toggleSelection = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const visibleProducts = useMemo(() => {
  return filtered
    .filter((p) => {
      // Check if product is enabled for this specific catalogue
      const isEnabled = isProductEnabledForCatalogue(p, catalogueId);
      if (!isEnabled) return false;

      // Use the catalogue's stockField instead of hardcoded resellStock
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
        (p.name || "").toLowerCase().includes((search || "").toLowerCase()) ||
        (p.subtitle || "").toLowerCase().includes((search || "").toLowerCase());
      return matchesStock && matchesCategory && matchesSearch;
    });
}, [filtered, stockFilter, categoryFilter, search, catalogueId, stockField]);


  let touchTimer = null;
  let startX = 0;
  let startY = 0;
  let moved = false;

  const handleTouchStart = (e, id) => {
    moved = false;
    const touch = e.touches?.[0] || e;
    startX = touch.clientX;
    startY = touch.clientY;

    touchTimer = setTimeout(() => {
      if (!moved) {
        if (!selectMode) {
  window.history.pushState({ select: true }, ""); // Push fake screen only once
}
setSelectMode(true);
setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));

        }
    }, 300);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches?.[0] || e;
    const dx = Math.abs(touch.clientX - startX);
    const dy = Math.abs(touch.clientY - startY);
    if (dx > 10 || dy > 10) {
      moved = true;
      clearTimeout(touchTimer);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimer);
  };

  const handleCardClick = (id) => {
    if (selectMode) {
      toggleSelection(id);
    } else {
      openPreviewHtml(id, catalogueId, visibleProducts);
    }
  };

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

  useEffect(() => {
    const toggleFilterHandler = () => setShowFilters((prev) => !prev);
    window.addEventListener("toggle-resell-filter", toggleFilterHandler);
    return () => window.removeEventListener("toggle-resell-filter", toggleFilterHandler);
  }, []);

  useEffect(() => {
    const container = document.getElementById("resell-header-icons");
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
      count.innerText = selected.length;
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
          mode: "resell",
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
        if (selectMode) {
          setSelectMode(false);
          setSelected([]);
        } else {
          onBack();
        }
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
      setSelectMode(false);
      setSelected([]);
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
  <div className="relative flex items-center gap-2 shrink-0 ml-2">
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
  onClick={async () => {
    await handleShare({
      selected,
      setProcessing,
      setProcessingIndex,
      setProcessingTotal,
      folder: catalogueLabel,
      mode: "resell",
      products: allProducts,
    });
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
    <div className="relative ml-auto">
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
            onClick={() => {
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
            onClick={() => {
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
            onClick={() => {
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
                onClick={() => {
                  if (!guardCloudWrite()) return;
                  const savedAt = new Date().toISOString();
                  const updated = allProducts.map((p) => {
                    if (!selected.includes(p.id)) return p;
                    const copy = {
                      ...p,
                      catalogueData: p.catalogueData
                        ? JSON.parse(JSON.stringify(p.catalogueData))
                        : undefined,
                      [stockField]: true,
                      updatedAt: savedAt,
                    };
                    return setCatalogueData(copy, catalogueId, { [stockField]: true });
                  });
                  saveProducts(updated);
                  setProducts(updated);
                  window.dispatchEvent(
                    new CustomEvent("product-added", {
                      detail: {
                        onlyProductIds: selected.map(String),
                        forceCloudSync: true,
                      },
                    })
                  );
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
                onClick={() => {
                  if (!guardCloudWrite()) return;
                  const savedAt = new Date().toISOString();
                  const updated = allProducts.map((p) => {
                    if (!selected.includes(p.id)) return p;
                    const copy = {
                      ...p,
                      catalogueData: p.catalogueData
                        ? JSON.parse(JSON.stringify(p.catalogueData))
                        : undefined,
                      [stockField]: false,
                      updatedAt: savedAt,
                    };
                    return setCatalogueData(copy, catalogueId, { [stockField]: false });
                  });
                  saveProducts(updated);
                  setProducts(updated);
                  window.dispatchEvent(
                    new CustomEvent("product-added", {
                      detail: {
                        onlyProductIds: selected.map(String),
                        forceCloudSync: true,
                      },
                    })
                  );
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

    

<div className="px-0 pb-28 pt-10">
      {/* Grid */}
      <div
        id="capture-area"
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 select-none"
      >
        {visibleProducts.map((p) => {
          const isSelected = selected.includes(p.id);
          return (
            <div
              key={p.id}
              data-id={p.id}
              className={`share-card bg-white rounded-sm shadow-sm overflow-hidden relative cursor-pointer transition-all duration-200 ${
                !p[stockField] ? "opacity-100" : ""
              }`}
              onClick={() => handleCardClick(p.id)}
onTouchStart={(e) => handleTouchStart(e, p.id)}
onTouchMove={handleTouchMove}
onTouchEnd={handleTouchEnd}
onMouseDown={(e) => handleTouchStart(e, p.id)}
onMouseMove={handleTouchMove}
onMouseUp={handleTouchEnd}
onMouseLeave={handleTouchEnd}

            >
              <div className="relative aspect-square overflow-hidden bg-gray-100 group">
                <img
                  src={imageMap[p.id]}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
                {!p[stockField] && (
                  <div className="absolute top-1/2 left-1/2 w-[140%] -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] bg-red-500 bg-opacity-60 text-white text-center py-0.5 shadow-md">
                    <span className="block text-sm font-bold tracking-wider">
                      OUT OF STOCK
                    </span>
                  </div>
                )}

                {/* Edit Icon Button */}
                {showEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Save scroll position before navigating - use main element scroll
                      const mainElement = document.querySelector('main');
                      if (mainElement) {
                        localStorage.setItem(`catalogueScroll-${catalogueId}`, mainElement.scrollTop.toString());
                      }
                      const evt = new CustomEvent("edit-product", { detail: { id: p.id, catalogueId, fromCatalogue: catalogueId } });
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
      {/* Gray overlay with fade-out */}
      <motion.div
        key="overlay"
        className="absolute inset-0 z-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ backgroundColor: "black" }}
      />

      {/* Tick animation */}
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
              
{/* Price Badge Over Image */}
{showInfo && (
<div
  className="absolute top-1.5 left-1.5 bg-green-800 text-white text-[11px] font-medium px-2 py-0.45 rounded-full shadow-md tracking-wide z-10"
>
  {(() => {
    const row = getCatalogueData(p, catalogueId);
    const r = resolveListOfferEffective(row, priceField, p);
    if (r.showStrikeout) {
      return (
        <>
          {currencySymbol}{r.offerPrice}
          <span style={{ ...STRUCK_LIST_PRICE_STYLE, marginLeft: 3 }}>{currencySymbol}{r.listPrice}</span>
        </>
      );
    }
    return <>{currencySymbol}{r.effectiveUnitPrice || getProductCatalogueData(p).price}</>;
  })()}
</div>
)}


{/* Name Below Image */}
{showInfo && (
<div
  className="absolute bottom-0 left-0 w-full px-1 py-1 text-center font-medium text-white text-[11px] sm:text-[12px] md:text-[14px] truncate"
  style={{
    backgroundColor: "rgba(0, 0, 0, 0.45)", // consistent overlay
    backdropFilter: "blur(1px)",
  }}
>
  {p.name}
</div>
)}

             

              {/* Share Preview Content */}
              <div
                className={`hidden full-detail-${p.id}`}
                style={{
                  width: "100%",
                  padding: 0,
                  margin: 0,
                  overflow: "hidden",
    boxSizing: "border-box",
    backgroundColor: "#fff",
                }}
              >
                <div
                  style={{
                    backgroundColor: p.imageBgColor || "white",
                    padding: "16px",
                    textAlign: "center",
                    position: "relative",
                    boxShadow: "0 12px 15px -6px rgba(0, 0, 0, 0.4  )", // ⬅️ shadow BELOW
                  }}
                >
                  <img
      src={imageMap[p.id]}
      alt={p.name}
      style={{
        maxWidth: "100%",
        maxHeight: "300px",
        objectFit: "contain",
        margin: "0 auto",
                    }}
                  />
                  {p.badge && (
  <div
    style={{
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor:
        p.imageBgColor?.toLowerCase() === "white" ? "#fff" : "#000",
      color:
        p.imageBgColor?.toLowerCase() === "white" ? "#000" : "#fff",
      fontSize: 11,
      fontWeight: 400,
      padding: "4px 9px",
      borderRadius: "20px",
      opacity: 0.98,
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      border: `1.5px solid ${
        p.imageBgColor?.toLowerCase() === "white"
          ? "rgba(0,0,0,0.4)"
          : "rgba(255,255,255,0.4)"
      }`,
      letterSpacing: "0.3px",
      lineHeight: "1.4",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {p.badge.toUpperCase()}
  </div>
)}


                  {!p[stockField] && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%) rotate(-30deg)",
                        width: "140%",
                        backgroundColor: "rgba(220, 38, 38, 0.6)",
                        color: "white",
                        textAlign: "center",
                        padding: "10px 0",
                        fontSize: "18px",
                        fontWeight: "bold",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    >
                      OUT OF STOCK
                    </div>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor: getLighterColor(p.bgColor || "#add8e6"),
                    color: p.fontColor || "white",
                    padding: "4px 8px",
                    fontSize: 17,
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: 6 }}>
                    <p
                      style={{
                        fontWeight: "normal",
                        textShadow: "3px 3px 5px rgba(0,0,0,0.2)",
                        fontSize: 28,
                        margin: "0 0 3px 0",
                      }}
                    >
                      {p.name}
                    </p>
                    {p.subtitle && (
                      <p
                        style={{ fontStyle: "italic", fontSize: 18, margin: "0 0 0 0" }}
                      >
                        ({p.subtitle})
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: "left", lineHeight: 1.4 }}>
                    {getAllFields()
                      .filter(f => f.enabled && f.key.startsWith('field'))
                      .map(field => {
                        const catData = getProductCatalogueData(p);
                        const val = catData[field.key];
                        if (!val) return null;
                        const unit = catData[`${field.key}Unit`];
                        const displayUnit = unit && unit !== "None" ? unit : "";

                        return (
                          <p key={field.key} style={{ margin: "2px 0" }}>
                            &nbsp; {field.label}
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:
                            &nbsp;&nbsp;{val} {displayUnit}
                          </p>
                        );
                      })}
                  </div>
                </div>

                <h2
                  style={{
                    backgroundColor: p.bgColor || "#add8e6",
                    color: p.fontColor || "white",
                    padding: "5px 8px",
                    textAlign: "center",
                    fontWeight: "normal",
                    fontSize: 19,
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {(() => {
                    const row = getCatalogueData(p, catalogueId);
                    const r = resolveListOfferEffective(row, priceField, p);
                    const u = getProductCatalogueData(p).priceUnit;
                    const udisp = u && u !== "None" ? u : "";
                    if (r.showStrikeout) {
                      return (
                        <>
                          Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;{currencySymbol}{r.offerPrice}{" "}
                          <span style={STRUCK_LIST_PRICE_STYLE}>{currencySymbol}{r.listPrice}</span>
                          {udisp ? ` ${udisp}` : ""}
                        </>
                      );
                    }
                    return (
                      <>
                        Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;{currencySymbol}{getProductCatalogueData(p).price}{" "}
                        {udisp}
                      </>
                    );
                  })()}
                </h2>
              </div>
            </div>
          );
        })}
      </div>
      {processing && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-xl px-6 py-4 text-center animate-fadeIn space-y-3 w-64">
      <div className="text-lg font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
        🖼️ Creating image {processingIndex} of {processingTotal}
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-green-500 transition-all duration-500 relative"
          style={{
            width: `${(processingIndex / processingTotal) * 100 || 0}%`,
          }}
        >
          {/* Shimmer animation to show activity */}
          <div
            className="absolute inset-0 w-full h-full animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%'
            }}
          />
        </div>
      </div>
      <div className="text-xs text-gray-400">Please wait…</div>
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
      className="fixed right-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-300 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-400 shadow-sm hover:shadow-md transition-all"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
      title="Add products to this catalogue"
    >
      <FiPlus size={20} />
      <span className="text-sm font-medium">Add</span>
    </button>
    </>
  );
}
