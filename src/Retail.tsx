import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { FiSettings, FiPlus, FiEdit } from "react-icons/fi";
import Cropper from "react-easy-crop";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { getCroppedImg } from "./cropUtils";
import { getPalette } from "./colorUtils";
import { handleShare } from "./Share";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App } from "@capacitor/app";
import ProductPreviewModal from "./ProductPreviewModal";
import { useToast } from "./context/ToastContext";
import { getFieldConfig } from "./config/fieldConfig";
import { getCurrentCurrencySymbol, onCurrencyChange } from "./utils/currencyUtils";
import { getPriceUnits } from "./utils/priceUnitsUtils";
import { logProductAdded, logProductEdited, logProductDeleted } from "./config/analyticsEvents";
import { getPersistedAuthUserId } from "./utils/authUserId";
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from "./utils/safeStorage";
import { productImageDisplayUrl } from "./utils/imageUrl";

export default function Retail({ products = [] }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const authUserId = getPersistedAuthUserId();
  const retailProductsStorageKey = authUserId
    ? getStorageKey("retailProducts", authUserId)
    : "retailProducts";

  const [retailProducts, setRetailProducts] = useState(() =>
    safeGetFromStorage(retailProductsStorageKey, [])
  );
  const [markupPercent, setMarkupPercent] = useState(() =>
    parseFloat(localStorage.getItem("retailMarkupPercent") || "30")
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);
  const [selectedToPull, setSelectedToPull] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [previewProductRetail, setPreviewProductRetail] = useState(null);

  // image / crop states
  const [imagePreview, setImagePreview] = useState(null);

  // selection & share
  const [selected, setSelected] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());

  useEffect(() => {
    // Listen for currency changes
    const unsubscribe = onCurrencyChange((currency, symbol) => {
      setCurrencySymbol(symbol);
    });
    return unsubscribe;
  }, []);

  // touch selection helpers
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
          window.history.pushState({ select: true }, "");
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

  const toggleSelection = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openPreviewHtml = (id, tab = null, filteredList = []) => {
    const evt = new CustomEvent("open-preview", { detail: { id, tab, filtered: filteredList } });
    window.dispatchEvent(evt);
  };

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
        window.history.pushState({ select: true }, "");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectMode]);

  useEffect(() => {
    if (selected.length === 0) setSelectMode(false);
  }, [selected]);

  useEffect(() => {
    // Push a fake entry to trap back
    window.history.pushState({ tab: "retail" }, "");
  }, []);

  useEffect(() => {
    const container = document.getElementById("retail-header-icons");
    if (!container) return;
    container.innerHTML = "";

    // Only show selection-related icons when in selectMode

    if (selectMode) {
      const count = document.createElement("span");
      count.className = "text-xs bg-red-500 text-white rounded-full px-1";
      count.innerText = String(selected.length);
      container.appendChild(count);

      const shareBtn = document.createElement("button");
      shareBtn.className = "text-green-600 hover:text-green-800 ml-2";
      shareBtn.innerHTML = `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M16.5 12a4.5 4.5 0 01-9 0m9 0A4.5 4.5 0 007.5 12m9 0V5.25M7.5 12V5.25m0 0h9' /></svg>`;
      shareBtn.onclick = async () => {
        await handleShare({ selected, setProcessing, setProcessingIndex, setProcessingTotal, mode: "retail", products: retailProducts });
      };
      container.appendChild(shareBtn);

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "ml-2 text-sm text-gray-600 hover:text-black";
      toggleBtn.innerHTML =
        selected.length === retailProducts.length
          ? `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M4 6h16M4 12h16M4 18h16' /></svg>`
          : `<svg class='w-5 h-5' fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M5 13l4 4L19 7' /></svg>`;
      toggleBtn.title = selected.length === retailProducts.length ? "Deselect All" : "Select All";
      toggleBtn.onclick = () =>
        setSelected(selected.length === retailProducts.length ? [] : retailProducts.map((p) => p.id));
      container.appendChild(toggleBtn);
    }
  }, [selectMode, selected, retailProducts]);
  const [originalBase64, setOriginalBase64] = useState(null);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [overrideColor, setOverrideColor] = useState("#d1b3c4");
  const [fontColor, setFontColor] = useState("white");
  const [imageBgOverride, setImageBgOverride] = useState("white");
  const [suggestedColors, setSuggestedColors] = useState([]);
  const [showInfo, setShowInfo] = useState(false);

  const onCropComplete = useCallback((_, areaPixels) => setCroppedAreaPixels(areaPixels), []);

  const handleSelectImage = async () => {
    const defaultFolder = "Phone/Pictures/Photoroom";
    const folder = localStorage.getItem("lastUsedFolder") || defaultFolder;

    try {
      const res = await Filesystem.readdir({ path: folder, directory: Directory.External });
      const imageFile = res.files.find((f) => f.name.match(/\.(jpg|jpeg|png|webp)$/i));
      if (!imageFile) throw new Error("No image files found in folder");

      const fullPath = `${folder}/${imageFile.name}`;
      const fileData = await Filesystem.readFile({ path: fullPath, directory: Directory.External });
      const base64 = `data:image/png;base64,${fileData.data}`;
      setOriginalBase64(base64);
      setImagePreview(base64);
      setCropping(true);
      localStorage.setItem("lastUsedFolder", folder);
    } catch (err) {
      console.warn("Fallback to system file picker:", err.message);
      document.getElementById("retail-fallback-file-input").click();
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result;
        if (file.webkitRelativePath || file.name) {
          const fakePath = file.webkitRelativePath || file.name;
          const folderPath = fakePath.substring(0, fakePath.lastIndexOf("/"));
          localStorage.setItem("lastUsedFolder", folderPath);
        }
        setOriginalBase64(base64Data);
        setImagePreview(base64Data);
        setCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyCrop = async () => {
    if (!imagePreview || !croppedAreaPixels) return;
    try {
      const croppedBase64 = await getCroppedImg(imagePreview, croppedAreaPixels);
      setImagePreview(croppedBase64);
      setCropping(false);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (error) {
      console.error("Crop failed:", error);
    }
  };

  useEffect(() => {
    if (imagePreview) {
      const img = new Image();
      img.src = imagePreview;
      img.onload = () => {
        const palette = getPalette(img, 12);
        setSuggestedColors(palette);
      };
    }
  }, [imagePreview]);

  const getLighterColor = (color) => {
    try {
      if (typeof color === 'string' && color.startsWith('#') && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const lighten = (c) => Math.min(255, c + 40);
        return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
      }
      const rgbMatch = String(color).match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        const lighten = (c) => Math.min(255, c + 40);
        return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
      }
    } catch (err) {
      return color;
    }
    return color;
  };

  // Sync a retail product into the active products list.
  // For authenticated users, this must be user-scoped to prevent cross-account leakage.
  const syncUpsertProductToGlobal = (prod) => {
    try {
      const uid = getPersistedAuthUserId();
      const keyedKey = uid ? getStorageKey("products", uid) : null;

      const all = keyedKey
        ? safeGetFromStorage(keyedKey, [])
        : JSON.parse(localStorage.getItem("products") || "[]");
      const idx = all.findIndex((p) => p.id === prod.id);
      const entry = {
        id: prod.id,
        name: prod.name || "",
        subtitle: prod.subtitle || "",
        price1: prod.price1 || prod.wholesale || 0,
        // Keep old names for backward compatibility
        wholesale: prod.price1 || prod.wholesale || 0,
        image: prod.image || prod.imagePath || "",
        imagePath: prod.imagePath || prod.image || "",
        category: prod.category || [],
        note: prod.note || "",
      };
      if (idx > -1) {
        all[idx] = { ...all[idx], ...entry };
      } else {
        all.unshift(entry);
      }
      if (keyedKey) {
        safeSetInStorage(keyedKey, all);
      } else {
        localStorage.setItem("products", JSON.stringify(all));
      }
      window.dispatchEvent(new CustomEvent("product-added"));
    } catch (err) {
      console.warn("Failed to sync product to global products", err);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(retailProductsStorageKey, JSON.stringify(retailProducts));
    } catch (err) {
      console.warn("localStorage quota exceeded while saving retailProducts, stripping large data URLs and retrying", err);
      try {
        const sanitized = retailProducts.map((p) => {
          const copy = { ...p };
          if (copy.image && typeof copy.image === "string" && copy.image.startsWith("data:image")) {
            // Remove large base64 image payloads before saving
            copy.image = "";
          }
          return copy;
        });
        localStorage.setItem(retailProductsStorageKey, JSON.stringify(sanitized));
      } catch (err2) {
        console.warn("Failed to save sanitized retailProducts to localStorage", err2);
      }
    }
  }, [retailProducts]);

  useEffect(() => {
    localStorage.setItem("retailMarkupPercent", String(markupPercent));
  }, [markupPercent]);

  const openPull = () => {
    setSelectedToPull([]);
    setShowPullModal(true);
  };

  const toggleSelectToPull = (id) => {
    setSelectedToPull((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const importSelected = () => {
    const toImport = products.filter((p) => selectedToPull.includes(p.id));
    const copies = toImport.map((p) => {
      const price1 = Number(p.price1 || p.wholesale || p.wholesalePrice || 0) || 0;
      const retailPrice = Math.round(price1 + (price1 * markupPercent) / 100);
      return {
        id: uuidv4(),
        sourceId: p.id,
        name: p.name || "",
        subtitle: p.subtitle || "",
        price1: retailPrice,
        price1Unit: p.price1Unit || getPriceUnits()[0],
        // Keep old names for backward compatibility
        wholesale: retailPrice,
        retail: retailPrice,
        image: p.image || p.imagePath || "",
        imagePath: p.imagePath || (p.image && typeof p.image === 'string' && (p.image.startsWith('retail/') || p.image.startsWith('catalogue/')) ? p.image : undefined),
        category: p.category || [],
        note: p.note || "",
      };
    });

    setRetailProducts((prev) => [...copies, ...prev]);
    setShowPullModal(false);

    // Track product import
    logProductAdded(copies.length);

    // Imported copies come from the global products list already, so no need to sync.
  };

  const saveEditedProduct = () => {
    setRetailProducts((prev) => prev.map((p) => (p.id === editingId ? editingProduct : p)));
    // Also update global products if this item exists there (created from Retail)
    try {
      syncUpsertProductToGlobal(editingProduct);
    } catch (err) {
      console.warn('Failed to sync edited product to global products', err);
    }
    logProductEdited(editingId);
    setEditingId(null);
    setEditingProduct(null);
  };

  const addEmptyProduct = () => {
    const p = {
      id: uuidv4(),
      name: "New Product",
      subtitle: "",
      price1: 0,
      price1Unit: getPriceUnits()[0],
      // Keep old names for backward compatibility
      wholesale: 0,
      image: "",
      category: [],
      note: "",
    };
    setRetailProducts((prev) => [p, ...prev]);
    // Also create a corresponding entry in global products so it's available in Wholesale
    try {
      syncUpsertProductToGlobal(p);
    } catch (err) {
      console.warn('Failed to add new retail product to global products', err);
    }
    logProductAdded();
    setEditingId(p.id);
    setEditingProduct(p);
  };

  const updateMarkup = (val) => {
    const n = Number(val);
    if (Number.isNaN(n)) return;
    setMarkupPercent(n);
  };

  const [imageMap, setImageMap] = useState({});

  useEffect(() => {
    // preload images for retailProducts
    (async () => {
      const map = {};
      for (const p of retailProducts) {
        try {
          if (p.image && typeof p.image === "string") {
            if (p.image.startsWith("data:image")) {
              map[p.id] = p.image;
            } else if (p.image.startsWith("retail/") || p.image.startsWith("catalogue/")) {
              try {
                const res = await Filesystem.readFile({ path: p.image, directory: Directory.Data });
                map[p.id] = `data:image/png;base64,${res.data}`;
              } catch (err) {
                // cannot read file (web), try to use as-is
                map[p.id] = p.image;
              }
            } else {
              // unknown string, try as URL
              map[p.id] = p.image;
            }
          }
        } catch (err) {
          console.warn("Retail image preload failed:", err);
        }
      }
      setImageMap(map);
    })();
  }, [retailProducts]);

  const handleDownload = async (e, productId, productName) => {
    e.stopPropagation();
    try {
      const imageUrl = imageMap[productId];
      if (!imageUrl) return;

      // Convert data URL or fetch the image
      let blob;
      if (imageUrl.startsWith('data:')) {
        const arr = imageUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }

      // Get file extension from mime type
      const mimeType = blob.type || 'image/png';
      const ext = mimeType.split('/')[1] || 'png';
      const filename = `${productName || 'product'}_${productId}.${ext}`;

      // Use FileSaver or Filesystem API for download
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'Image', accept: { [mimeType]: [`.${ext}`] } }],
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
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] bg-gradient-to-b from-white to-gray-100 relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-screen h-[40px] bg-black z-50" />
      <header className="fixed top-[40px] left-1/2 -translate-x-1/2 w-screen z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center gap-3 px-4 relative">
        <button
          onClick={() => {
            if (selectMode) {
              setSelectMode(false);
              setSelected([]);
            } else {
              navigate("/");
              setTimeout(() => window.dispatchEvent(new Event("toggle-menu")), 120);
            }
          }}
          className="relative w-8 h-8 shrink-0 flex items-center justify-center"
          title={selectMode ? "Exit Selection" : "Menu"}
        >
          <span
            className="absolute w-6 h-0.5 bg-gray-700"
            style={{ transform: selectMode ? "rotate(45deg)" : "translateY(-8px)" }}
          />
          <span
            className="absolute w-6 h-0.5 bg-gray-700"
            style={{ opacity: selectMode ? 0 : 1 }}
          />
          <span
            className="absolute w-6 h-0.5 bg-gray-700"
            style={{ transform: selectMode ? "rotate(-45deg)" : "translateY(8px)" }}
          />
        </button>
        <h1 className="text-xl font-bold truncate">Retail</h1>
        <div className="flex-1" />
        <div id="retail-header-icons" className="relative flex items-center gap-2 shrink-0 ml-2" />
        <button
          onClick={() => setShowSettings(true)}
          className="text-xl text-gray-600 hover:text-black"
          title="Settings"
        >
          <FiSettings />
        </button>
      </header>

      <main className="pt-[calc(40px+56px)] px-4 pb-28">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={openPull}
              className="px-3 py-2 bg-blue-600 text-white rounded-md"
            >
              Pull from Products
            </button>
            <button
              onClick={addEmptyProduct}
              className="px-3 py-2 bg-green-600 text-white rounded-md flex items-center gap-2"
            >
              <FiPlus /> Add Product
            </button>
          </div>
          <div className="text-sm text-gray-600">Default markup: {markupPercent}%</div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 select-none" id="retail-capture-area">
          {retailProducts.map((p) => (
            <div
              key={p.id}
              data-id={p.id}
              className={`share-card bg-white rounded-sm shadow-sm overflow-hidden relative cursor-pointer transition-all duration-200`}
              onClick={() => {
                if (selectMode) {
                  toggleSelection(p.id);
                } else {
                  // Always preview inside Retail page (use retailProducts as list)
                  setPreviewProductRetail(p);
                }
              }}
              onTouchStart={(e) => handleTouchStart(e, p.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={(e) => handleTouchStart(e, p.id)}
              onMouseMove={handleTouchMove}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                {imageMap[p.id] ? (
                  <img src={imageMap[p.id]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                )}

                <div className="absolute top-1 right-1 flex gap-1 z-10">
                  <button onClick={(e) => handleDownload(e, p.id, p.name)} className="w-8 h-8 bg-white/90 hover:bg-white rounded flex items-center justify-center shadow text-sm text-gray-700 hover:text-gray-900 transition-colors" title="Download image">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button onClick={async (e) => { e.stopPropagation(); setEditingId(p.id); setEditingProduct({ ...p }); try { if (p.image && typeof p.image === 'string' && p.image.startsWith('retail/')) { const res = await Filesystem.readFile({ path: p.image, directory: Directory.Data }); setImagePreview(`data:image/png;base64,${res.data}`); } else if (p.image && p.image.startsWith('data:image')) { setImagePreview(p.image); } else { setImagePreview(null); } } catch (err) { console.warn('Failed to read image for edit:', err); setImagePreview(null); } }} className="w-8 h-8 bg-white/90 hover:bg-white rounded flex items-center justify-center shadow text-sm text-blue-600 hover:text-blue-800 transition-colors" title="Edit product">
                    <FiEdit className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    // remove from retail list
                    setRetailProducts((prev) => prev.filter((x) => x.id !== p.id));
                    // If this retail product was created locally (no sourceId), remove from global products as well
                    try {
                      if (!p.sourceId) {
                        const all = JSON.parse(localStorage.getItem('products') || '[]');
                        const updated = all.filter((x) => x.id !== p.id);
                        localStorage.setItem('products', JSON.stringify(updated));
                        window.dispatchEvent(new CustomEvent('product-added'));
                      }
                    } catch (err) {
                      console.warn('Failed to remove product from global products', err);
                    }
                    logProductDeleted(p.id);
                  }} className="w-8 h-8 bg-white/90 hover:bg-white rounded flex items-center justify-center shadow text-sm text-red-600 hover:text-red-800 transition-colors" title="Delete product">🗑️</button>
                </div>
              </div>

              <div className="px-1 py-1 flex items-center justify-between text-[11px]">
                <div className="truncate text-left font-medium">{p.name}</div>
                <div className="ml-2">
                  <span className="bg-red-800 text-white text-[11px] font-medium px-2 py-0.5 rounded-full shadow-md">{currencySymbol}{p.retail}</span>
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* preload images for retail products */}
      </main>

      {showPullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-3">Pull products from Products</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-auto mb-3">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-3 p-2 border rounded">
                  <input type="checkbox" checked={selectedToPull.includes(p.id)} onChange={() => toggleSelectToPull(p.id)} />
                  <img
                    key={productImageDisplayUrl(p.imageUrl || p.image || p.imagePath, p.imageVersion)}
                    src={productImageDisplayUrl(p.imageUrl || p.image || p.imagePath, p.imageVersion)}
                    alt=""
                    className="w-12 h-12 object-cover rounded bg-gray-100"
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">Wholesale: {currencySymbol}{p.wholesale || 0}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <div>
                <label className="text-sm mr-2">Markup %</label>
                <input type="number" className="w-20 px-2 py-1 border rounded" value={markupPercent} onChange={(e) => updateMarkup(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowPullModal(false)} className="px-3 py-2 rounded bg-gray-200">Cancel</button>
                <button onClick={importSelected} className="px-3 py-2 rounded bg-blue-600 text-white">Import</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-3">Retail Settings</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1">Default markup %</label>
              <input type="number" className="w-full px-3 py-2 border rounded" value={markupPercent} onChange={(e) => updateMarkup(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSettings(false)} className="px-3 py-2 rounded bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {processing && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-xl px-6 py-4 text-center animate-fadeIn space-y-3 w-64">
      <div className="text-lg font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
        🖼️ Creating image {processingIndex} of {processingTotal}
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{
            width: `${(processingIndex / processingTotal) * 100 || 0}%`,
          }}
        ></div>
      </div>
      <div className="text-xs text-gray-400">Please wait…</div>
    </div>
  </div>
)}

      {previewProductRetail && (
        <ProductPreviewModal
          product={previewProductRetail}
          tab="retail"
          catalogueId={null}
          filteredProducts={retailProducts}
          onClose={() => setPreviewProductRetail(null)}
          onEdit={() => {
            setEditingId(previewProductRetail.id);
            setEditingProduct(previewProductRetail);
            setPreviewProductRetail(null);
          }}
          onToggleStock={() => {}}
          onSwipeLeft={(next) => setPreviewProductRetail(next)}
          onSwipeRight={(prev) => setPreviewProductRetail(prev)}
          onShelf={() => {}}
        />
      )}

      {editingId && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="h-full w-full max-w-4xl mx-auto bg-white overflow-auto" style={{ paddingTop: '56px' }}>
            <div className="fixed top-0 left-0 right-0 h-[40px] bg-black z-50" />
            <header className="fixed top-[40px] left-1/2 -translate-x-1/2 w-full max-w-4xl z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setEditingId(null); setEditingProduct(null); setImagePreview(null); setCropping(false); }} className="w-8 h-8 flex items-center justify-center">←</button>
                <h1 className="text-lg font-semibold">{editingProduct.name || 'Edit Product'}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSelectImage} className="text-sm px-3 py-1 bg-gray-100 rounded">Choose Image</button>
                <button onClick={async () => {
                  try {
                    const id = editingId;
                    let imagePath = editingProduct.image || '';
                    if (imagePreview && imagePreview.startsWith('data:image')) {
                      const base64 = imagePreview.split(',')[1];
                      imagePath = `retail/product-${id}.png`;
                      await Filesystem.writeFile({ path: imagePath, data: base64, directory: Directory.Data, recursive: true });
                      // Also save a copy to external storage for sharing (consistent filename pattern)
                      try {
                        const shareFilename = `product_${id}_retail.png`;
                        await Filesystem.writeFile({ path: `Retail/${shareFilename}`, data: base64, directory: Directory.External, recursive: true });
                      } catch (err) {
                        console.warn('Could not write external share copy:', err);
                      }
                      const dataUrl = `data:image/png;base64,${base64}`;
                      // Store only the imagePath in state to avoid persisting large base64 strings in localStorage
                      const updatedProduct = { ...editingProduct, image: imagePath, imagePath };
                      setRetailProducts(prev => prev.map(p => p.id===id ? updatedProduct : p));
                      // Sync the saved retail product to global products (wholesale/resell)
                      try {
                        syncUpsertProductToGlobal(updatedProduct);
                      } catch (err) {
                        console.warn('Failed to sync saved retail product to global products', err);
                      }
                    } else {
                      setRetailProducts(prev => prev.map(p => p.id===id ? { ...editingProduct, image: imagePath, imagePath } : p));
                    }
                    setEditingId(null);
                    setEditingProduct(null);
                    setImagePreview(null);
                  } catch (err) {
                    showToast('Image save failed: ' + err.message, 'error');
                  }
                }} className="px-3 py-2 rounded bg-blue-600 text-white">Save</button>
              </div>
            </header>

            <div className="px-4 pb-10">
              <div className="mb-4">
                <input type="file" id="retail-fallback-file-input" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </div>

              {cropping && imagePreview && (
                <div className="mb-4">
                  <div style={{ height: 360, position: 'relative' }}>
                    <Cropper image={imagePreview} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                  </div>
                  <div className="flex gap-4 mt-2 justify-center">
                    <button onClick={applyCrop} className="bg-blue-500 text-white px-4 py-1 rounded">Apply Crop</button>
                    <button onClick={() => setCropping(false)} className="bg-gray-300 px-4 py-1 rounded">Cancel</button>
                  </div>
                </div>
              )}

              {!cropping && (
                <>
                  <div className="max-w-2xl mx-auto">
                    <div className="mb-3">
                      <input className="border p-2 rounded w-full mb-2" placeholder="Model Name" value={editingProduct.name} onChange={(e) => setEditingProduct((s) => ({ ...s, name: e.target.value }))} />
                      <input className="border p-2 rounded w-full mb-2" placeholder="Subtitle" value={editingProduct.subtitle} onChange={(e) => setEditingProduct((s) => ({ ...s, subtitle: e.target.value }))} />
                      <div className="flex gap-2 mb-2">
                        <input name="price1" value={editingProduct.price1 || editingProduct.wholesale || ''} onChange={(e) => setEditingProduct((s) => ({ ...s, price1: Number(e.target.value), wholesale: Number(e.target.value) }))} placeholder="Price" className="border p-2 w-full rounded" />
                      </div>

                      <div className="flex gap-2 mb-2">
                        <input className="border p-2 w-full rounded" placeholder="Package" value={editingProduct.field2 || editingProduct.package || ''} onChange={(e) => setEditingProduct((s) => ({ ...s, field2: e.target.value, package: e.target.value }))} />
                        <input className="border p-2 w-full rounded" placeholder="Age Group" value={editingProduct.field3 || editingProduct.age || ''} onChange={(e) => setEditingProduct((s) => ({ ...s, field3: e.target.value, age: e.target.value }))} />
                      </div>

                      <label className="block text-sm font-medium mb-1">Product Badge</label>
                      <div className="flex gap-2 mb-3">
                        <input className="border p-2 rounded text-sm" value={editingProduct.badge || ''} onChange={(e) => setEditingProduct((s) => ({ ...s, badge: e.target.value }))} />
                      </div>

                      <div className="mb-3">
                        <label className="block mb-1 font-semibold">Categories</label>
                        <input className="w-full px-3 py-2 border rounded" placeholder="comma separated" value={(editingProduct.category || []).join(', ')} onChange={(e) => setEditingProduct((s) => ({ ...s, category: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) }))} />
                      </div>

                      <div className="my-3">
                        <label className="block mb-1 font-semibold">Override BG:</label>
                        <input type="color" value={overrideColor} onChange={(e) => setOverrideColor(e.target.value)} />
                      </div>

                      <div className="flex gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium">Font Color</label>
                          <div className="flex gap-2 mt-1">
                            {['white','black'].map(color=> (
                              <div key={color} onClick={() => setFontColor(color)} style={{ width:28, height:28, backgroundColor: color, border: fontColor===color ? '3px solid black' : '1px solid #ccc', borderRadius: '100%', cursor: 'pointer' }} />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium">Image BG</label>
                          <div className="flex gap-2 mt-1">
                            {['white','black'].map(color=> (
                              <div key={color} onClick={() => setImageBgOverride(color)} style={{ width:28, height:28, backgroundColor: color, border: imageBgOverride===color ? '3px solid black' : '1px solid #ccc', borderRadius: '100%', cursor: 'pointer' }} />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <div id="catalogue-preview" className="mt-6 border rounded shadow overflow-hidden" style={{ maxWidth: 330, width: '100%' }}>
                        {imagePreview && (
                          <div style={{ position: 'relative', backgroundColor: imageBgOverride, textAlign: 'center', padding: 10, boxShadow: '0 12px 15px -6px rgba(0, 0, 0, 0.4)' }}>
                            <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', margin: '0 auto' }} />
                          </div>
                        )}

                        <div style={{ backgroundColor: getLighterColor ? getLighterColor(overrideColor) : overrideColor, color: fontColor, padding: 10 }}>
                          <h2 className="text-lg font-semibold text-center">{editingProduct.name}</h2>
                          {editingProduct.subtitle && <p className="text-center italic text-sm">({editingProduct.subtitle})</p>}
                          <div className="text-sm mt-2 space-y-1">
                            <p>{getFieldConfig('field1')?.label || 'Colour'}&nbsp;&nbsp;: {editingProduct.field1 || editingProduct.color || ''}</p>
                            <p>{getFieldConfig('field2')?.label || 'Package'}&nbsp;: {editingProduct.field2 || editingProduct.package || ''}</p>
                            <p>{getFieldConfig('field3')?.label || 'Age Group'}&nbsp;: {editingProduct.field3 || editingProduct.age || ''}</p>
                          </div>
                        </div>

                        <div style={{ backgroundColor: overrideColor, color: fontColor, padding: 8, textAlign: 'center', fontWeight: 'normal', fontSize: 19 }}>
                          Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;{currencySymbol}{editingProduct.price1 || editingProduct.wholesale} {editingProduct.price1Unit || getPriceUnits()[0]}
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
