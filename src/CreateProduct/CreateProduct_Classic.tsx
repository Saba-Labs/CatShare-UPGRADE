// Final full CreateProduct.jsx with Save.jsx integration and new draggable layout

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import Cropper from "react-easy-crop";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { getCroppedImg } from "../cropUtils";
import { getPalette } from "../colorUtils";
import { saveRenderedImage } from "../Save";
import { uploadProductImageToR2 } from "../services/r2Upload";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { getAllCatalogues, type Catalogue } from "../config/catalogueConfig";
import { migrateProductToNewFormat } from "../config/fieldMigration";
import { getProductFieldValue, getProductUnitValue } from "../config/fieldMigration";
import { getPersistedAuthUserId } from "../utils/authUserId";
import {
  safeGetFromStorage,
  safeSetInStorage,
  getStorageKey,
  getUserImagePath,
} from "../utils/safeStorage";
import {
  MAX_PRODUCT_IMAGES,
  buildProductImagePersistFields,
  getProductImageUrls,
  getPrimaryImageIndex,
  normalizeProductImageFields,
  primaryIndexAfterSlotRemoved,
} from "../utils/productImages";
import { InfoTooltip } from "../components/InfoTooltip";
import {
  initializeCatalogueData,
  getCatalogueData,
  getDefaultCatalogueData,
  setCatalogueData,
  isProductEnabledForCatalogue,
  setProductEnabledForCatalogue,
  type CatalogueData,
  type ProductWithCatalogueData
} from "../config/catalogueProductUtils";
import { getFieldConfig, getAllFields, isFieldVisibleOnSurface } from "../config/fieldConfig";
import { getCurrentCurrencySymbol, onCurrencyChange } from "../utils/currencyUtils";
import { parseImageVersionFromUrl } from "../utils/imageUrl";
import { getPriceUnits } from "../utils/priceUnitsUtils";
import { logProductAdded, logCategoryManaged } from "../config/analyticsEvents";
import { useSubscription } from "../context/SubscriptionContext";
import { FREE_MAX_PRODUCTS } from "../config/freeTierLimits";
import { getAllProducts } from "../config/productUtils";
import { readCategoriesList, persistCategoriesList } from "../utils/categoriesStorage";
import OrderQuantityStepInput from "../components/OrderQuantityStepInput";
import MinimumOrderQuantityInput from "../components/MinimumOrderQuantityInput";
import QuantitySlabEditor from "../components/QuantitySlabEditor";
import { normalizeQuantitySlabs } from "../utils/quantityPricingUtils";
import ProductVariantsEditor from "../components/ProductVariantsEditor";
import VariantCombinationEditor from "../components/VariantCombinationEditor";
import {
  getProductVariantGroups,
  pruneVariantGroupsForSave,
  type ProductVariantGroup,
  type ProductVariantsConfig,
} from "../utils/productVariants";
import { useCloudWriteGate } from "../hooks/useCloudWriteGate";
import {
  offerPriceFieldFor,
  resolveListOfferEffective,
  STRUCK_LIST_PRICE_STYLE,
  isCataloguePriceOrOfferFieldName,
  sanitizeDecimalPriceInput,
  getOfferVersusPriceValidationError,
} from "../utils/offerPriceUtils";

// Helper function to get CSS styles based on watermark position
const getWatermarkPositionStyles = (position) => {
  const baseStyles = {
    position: "absolute",
    fontFamily: "Arial, sans-serif",
    fontWeight: 500,
    pointerEvents: "none",
    zIndex: 10
  };

  const positionMap = {
    "top-left": { top: 10, left: 10, transform: "none" },
    "top-center": { top: 10, left: "50%", transform: "translateX(-50%)" },
    "top-right": { top: 10, right: 10, left: "auto", transform: "none" },
    "middle-left": { top: "50%", left: 10, transform: "translateY(-50%)" },
    "middle-center": { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
    "middle-right": { top: "50%", right: 10, left: "auto", transform: "translateY(-50%)" },
    "bottom-left": { bottom: 10, left: 10, transform: "none" },
    "bottom-center": { bottom: 10, left: "50%", transform: "translateX(-50%)" },
    "bottom-right": { bottom: 10, right: 10, left: "auto", transform: "none" }
  };

  const selectedPosition = positionMap[position] || positionMap["bottom-left"];
  return { ...baseStyles, ...selectedPosition };
};

// Helper: Convert any color string to RGB array
const parseToRgb = (str) => {
  if (!str) return [255, 255, 255];

  // Handle Hex
  if (str.startsWith("#")) {
    const r = parseInt(str.slice(1, 3), 16) || 0;
    const g = parseInt(str.slice(3, 5), 16) || 0;
    const b = parseInt(str.slice(5, 7), 16) || 0;
    return [r, g, b];
  }

  // Handle RGB
  const match = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }

  return [255, 255, 255];
};

const rgbToHex = (r, g, b) => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`.toUpperCase();
};

const formatToHex = (str) => {
  if (!str) return "#FFFFFF";
  if (str.startsWith("#")) return str.toUpperCase();
  const [r, g, b] = parseToRgb(str);
  return rgbToHex(r, g, b);
};

function ColorPickerModal({ value, onChange, onClose }) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(50);
  const [hexInput, setHexInput] = useState("");

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  };

  const hslToRgb = (h, s, l) => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  // Initialize state on mount
  useEffect(() => {
    const [r, g, b] = parseToRgb(value);
    const [h, s, l] = rgbToHsl(r, g, b);
    setHue(h);
    setSaturation(s);
    setBrightness(l);
    setHexInput(rgbToHex(r, g, b));
  }, [value]);

  const currentColorRgb = hslToRgb(hue, saturation, brightness);
  const currentColorHex = rgbToHex(...(currentColorRgb as [number, number, number]));
  const currentColorStr = `rgb(${currentColorRgb[0]}, ${currentColorRgb[1]}, ${currentColorRgb[2]})`;

  const handleHexChange = (hex) => {
    setHexInput(hex);
    if (hex.match(/^#[0-9A-Fa-f]{6}$/)) {
      const [r, g, b] = parseToRgb(hex);
      const [h, s, l] = rgbToHsl(r, g, b);
      setHue(h);
      setSaturation(s);
      setBrightness(l);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-lg p-3 w-full" style={{ maxWidth: "320px" }}>
        <h2 className="font-bold text-lg mb-3">Choose Color</h2>

        {/* Hue Slider */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Hue</label>
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => {
              const h = parseFloat(e.target.value);
              setHue(h);
              const [r, g, b] = hslToRgb(h, saturation, brightness);
              setHexInput(rgbToHex(r, g, b));
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right,
                hsl(0, 100%, 50%), hsl(30, 100%, 50%), hsl(60, 100%, 50%),
                hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%),
                hsl(300, 100%, 50%), hsl(360, 100%, 50%))`
            }}
          />
        </div>

        {/* Saturation Slider */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Saturation</label>
          <input
            type="range"
            min="0"
            max="100"
            value={saturation}
            onChange={(e) => {
              const s = parseFloat(e.target.value);
              setSaturation(s);
              const [r, g, b] = hslToRgb(hue, s, brightness);
              setHexInput(rgbToHex(r, g, b));
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right,
                hsl(${hue}, 0%, ${brightness}%),
                hsl(${hue}, 100%, ${brightness}%))`
            }}
          />
        </div>

        {/* Brightness Slider */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Brightness</label>
          <input
            type="range"
            min="0"
            max="100"
            value={brightness}
            onChange={(e) => {
              const l = parseFloat(e.target.value);
              setBrightness(l);
              const [r, g, b] = hslToRgb(hue, saturation, l);
              setHexInput(rgbToHex(r, g, b));
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #000, hsl(${hue}, ${saturation}%, 50%), #fff)`
            }}
          />
        </div>

        {/* Color Preview */}
        <div className="mb-3">
          <div
            style={{ backgroundColor: currentColorStr }}
            className="w-full h-16 rounded-lg border-2 border-gray-300"
          />
        </div>

        {/* Hex Input */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Hex Code</label>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#ffffff"
            className="border rounded w-full p-2 text-sm font-mono"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onChange(currentColorStr)}
            className="flex-1 bg-blue-600 text-white py-2 rounded font-medium"
          >
            Apply
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateProduct() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get("id");
  const catalogueParam = searchParams.get("catalogue");
  const fromParam = searchParams.get("from");
  const { showToast } = useToast();
  const { currentTheme } = useTheme();
  const { isPro } = useSubscription();
  const { guardCloudWrite } = useCloudWriteGate();

  // When logged in, product/offline state should be stored per-user.
  // This prevents localStorage quota errors from the legacy unkeyed "products".
  const authUserId = getPersistedAuthUserId();
  const productsStorageKey = authUserId
    ? getStorageKey("products", authUserId)
    : "products";
  const useUserImages = Boolean(authUserId);

  const [categoryList, setCategoryList] = useState<string[]>(() => readCategoriesList(authUserId));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryAddOpen, setCategoryAddOpen] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddCategory = useCallback(() => {
    const c = newCategoryName.trim();
    if (!c) {
      showToast("Enter a category name", "warning");
      return;
    }
    if (authUserId && !guardCloudWrite()) return;
    if (categoryList.some((x) => x.toLowerCase() === c.toLowerCase())) {
      showToast("That category already exists", "warning");
      return;
    }
    const next = [...categoryList, c];
    persistCategoriesList(authUserId, next);
    setCategoryList(next);
    setNewCategoryName("");
    setCategoryAddOpen(false);
    logCategoryManaged("added", c);
    if (authUserId) {
      void import("../services/supabaseSync").then(({ syncCategories }) => {
        syncCategories(
          authUserId,
          next.map((name) => ({ id: name, name }))
        ).catch((err) => console.warn("⚠️ Failed to sync categories:", err));
      });
    }
  }, [authUserId, categoryList, newCategoryName, showToast, guardCloudWrite]);

  useEffect(() => {
    if (categoryAddOpen) {
      requestAnimationFrame(() => categoryInputRef.current?.focus());
    }
  }, [categoryAddOpen]);

  // Bottom sheet state using Framer Motion for buttery smooth performance
  const MAX_HEIGHT = typeof window !== 'undefined' ? window.innerHeight - 100 : 600;
  const MIN_HEIGHT = 120;
  const DRAG_RANGE = MAX_HEIGHT - MIN_HEIGHT;

  const y = useMotionValue(DRAG_RANGE * 0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [formSection, setFormSection] = useState<'basic' | 'catalogue' | 'variants'>('basic');
  const [showVariantDetailsModal, setShowVariantDetailsModal] = useState(false);
  const [variantGroups, setVariantGroups] = useState<ProductVariantGroup[]>([]);
  const [variantConfig, setVariantConfig] = useState<ProductVariantsConfig>({ groups: [] });
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollAtTopRef = useRef(true);
  const isVariantConfigInitializedRef = useRef(false);

  // Derived values for hardware-accelerated animations
  // Preview scale state must be declared before useTransform
  const [previewScale, setPreviewScale] = useState(1);

  // Initialize overrideColor from current theme instead of hardcoded value
  const [overrideColor, setOverrideColor] = useState(() => currentTheme.styles.bgColor);

  const sheetHeight = useTransform(y, [0, DRAG_RANGE], [MAX_HEIGHT, MIN_HEIGHT]);
  const imageScale = useTransform(y, [0, DRAG_RANGE], [0.4, 1]);
  const imageOpacity = useTransform(y, [0, DRAG_RANGE / 2, DRAG_RANGE], [0.6, 1, 1]);
  const arrowRotate = useTransform(y, [0, DRAG_RANGE], [180, 0]);

  // Combined scale: drag animation multiplied by responsive fit constraint
  const finalScale = useTransform(imageScale, (dragScale) => {
    // If content needs to shrink to fit, use the smaller of the two scales
    if (previewScale < 1) {
      return Math.min(dragScale, previewScale);
    }
    return dragScale;
  });

  const handleScrollCheck = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    isScrollAtTopRef.current = element.scrollTop === 0;
  };

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);
    const velocity = info.velocity.y;
    const currentY = y.get();
    const MIDDLE_POSITION = DRAG_RANGE * 0.5;

    // Snapping logic with 3 positions: top, middle, bottom
    if (velocity < -300 || currentY < DRAG_RANGE * 0.25) {
      // Snap to top (fully expanded)
      animate(y, 0, { type: "spring", stiffness: 400, damping: 40 });
    } else if (velocity > 500 || currentY > DRAG_RANGE * 0.75) {
      // Snap to bottom (collapsed) - requires strong downward velocity or more than 75% dragged
      animate(y, DRAG_RANGE, { type: "spring", stiffness: 400, damping: 40 });
    } else {
      // Snap to middle position if released in the middle range
      animate(y, MIDDLE_POSITION, { type: "spring", stiffness: 400, damping: 40 });
    }
  };

  const [formData, setFormData] = useState<ProductWithCatalogueData>({
    id: "",
    name: "",
    subtitle: "",
    privateNotes: "",
    category: [],
    catalogueData: {},
  });

  const [selectedCatalogue, setSelectedCatalogue] = useState<string>(catalogueParam || "cat1");
  const [fetchFieldsChecked, setFetchFieldsChecked] = useState(false);
  const [fetchPriceChecked, setFetchPriceChecked] = useState(false);
  const [imageSlots, setImageSlots] = useState<string[]>([]);
  const [primarySlotIndex, setPrimarySlotIndex] = useState(0);
  const [cropSessionPreview, setCropSessionPreview] = useState<string | null>(null);
  const cropModeRef = useRef<"append" | number | null>(null);
  const imageSlotsRef = useRef<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  const cardPreview = imageSlots[primarySlotIndex] ?? imageSlots[0] ?? null;

  useEffect(() => {
    imageSlotsRef.current = imageSlots;
  }, [imageSlots]);
  const [imageFilePath, setImageFilePath] = useState(null);
  const [showWatermark, setShowWatermarkLocal] = useState(() => {
    return safeGetFromStorage("showWatermark", true);
  });
  const [watermarkText, setWatermarkText] = useState(() => {
    return safeGetFromStorage("watermarkText", "Created using CatShare");
  });

  const [watermarkPosition, setWatermarkPosition] = useState(() => {
    return safeGetFromStorage("watermarkPosition", "bottom-left");
  });


  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());

  // Listen for currency changes
  useEffect(() => {
    const unsubscribe = onCurrencyChange((currency, symbol) => {
      setCurrencySymbol(symbol);
    });
    return unsubscribe;
  }, []);

  // Listen for watermark setting changes
  useEffect(() => {
    const handleStorageChange = () => {
      setShowWatermarkLocal(safeGetFromStorage("showWatermark", false));
      setWatermarkText(safeGetFromStorage("watermarkText", "Created using CatShare"));
      setWatermarkPosition(safeGetFromStorage("watermarkPosition", "bottom-left"));
    };

    const handleWatermarkChange = () => {
      setShowWatermarkLocal(safeGetFromStorage("showWatermark", false));
      setWatermarkText(safeGetFromStorage("watermarkText", "Created using CatShare"));
      setWatermarkPosition(safeGetFromStorage("watermarkPosition", "bottom-left"));
    };

    const handlePositionChange = () => {
      setWatermarkPosition(safeGetFromStorage("watermarkPosition", "bottom-left"));
    };

    const handleWatermarkToggle = () => {
      setShowWatermarkLocal(safeGetFromStorage("showWatermark", false));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("watermarkTextChanged", handleWatermarkChange);
    window.addEventListener("watermarkPositionChanged", handlePositionChange);
    window.addEventListener("watermarkChanged", handleWatermarkToggle);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("watermarkTextChanged", handleWatermarkChange);
      window.removeEventListener("watermarkPositionChanged", handlePositionChange);
      window.removeEventListener("watermarkChanged", handleWatermarkToggle);
    };
  }, []);

  const [originalBase64, setOriginalBase64] = useState(null);
  const [fontColor, setFontColor] = useState("black");
  const [imageBgOverride, setImageBgOverride] = useState("white");
  const [suggestedColors, setSuggestedColors] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const [price1Unit, setPrice1Unit] = useState("/ piece");
  const [packageUnit, setPackageUnit] = useState("pcs / set");
  const [ageGroupUnit, setAgeGroupUnit] = useState("months");
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [, setFieldDefinitionsUpdated] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Update preview colors when theme changes (unless user has customized them)
  useEffect(() => {
    // Only update if user hasn't explicitly set a color (i.e., still using theme default)
    if (!editingId) {
      setOverrideColor(currentTheme.styles.bgColor);
      setFontColor(currentTheme.styles.fontColor);
      setImageBgOverride(currentTheme.styles.imageBgColor);
      console.log(`🎨 Updated preview colors for theme: ${currentTheme.id}`);
    }
  }, [currentTheme.id, editingId]);

  // Initialize catalogues on mount
  useEffect(() => {
    const cats = getAllCatalogues();
    setCatalogues(cats);
  }, []);

  // Listen for field definition changes (e.g., after backup restore)
  useEffect(() => {
    const handleFieldDefinitionsChanged = (event) => {
      console.log("📝 Field definitions changed in CreateProduct, refreshing field labels...");
      // Force component to re-render by updating state
      setFieldDefinitionsUpdated(prev => prev + 1);
    };

    window.addEventListener("fieldDefinitionsChanged", handleFieldDefinitionsChanged);
    return () => window.removeEventListener("fieldDefinitionsChanged", handleFieldDefinitionsChanged);
  }, []);

  // Reset checkboxes when catalogue changes
  useEffect(() => {
    setFetchFieldsChecked(false);
    setFetchPriceChecked(false);
  }, [selectedCatalogue]);

  // Auto-save variant changes to Supabase when editing an existing product
  useEffect(() => {
    if (!editingId || !variantConfig.combinations?.length) return;

    // Skip the initial load—only sync when user actually changes variants
    if (!isVariantConfigInitializedRef.current) {
      isVariantConfigInitializedRef.current = true;
      return;
    }

    const autoSaveVariants = async () => {
      try {
        const authUserIdNow = getPersistedAuthUserId();
        if (!authUserIdNow) return;

        const productsStorageKeyNow = getStorageKey("products", authUserIdNow);
        const all = safeGetFromStorage(productsStorageKeyNow, []);
        const existing = all.find((p: any) => p.id === editingId);
        if (!existing) return;

        // Update the product with new variant config
        const updated = all.map((p: any) => {
          if (p.id === editingId) {
            const savedVariants = pruneVariantGroupsForSave(variantGroups);
            if (variantConfig.combinations && variantConfig.combinations.length > 0) {
              savedVariants.combinations = variantConfig.combinations;
            }
            if (savedVariants.groups.length > 0) {
              return { ...p, variants: savedVariants, updatedAt: new Date().toISOString() };
            } else {
              const copy = { ...p, updatedAt: new Date().toISOString() };
              delete copy.variants;
              return copy;
            }
          }
          return p;
        });

        // Save to localStorage
        const ok = safeSetInStorage(productsStorageKeyNow, updated);
        if (ok) {
          // Trigger Supabase sync with forceCloudSync flag
          window.dispatchEvent(
            new CustomEvent("product-added", {
              detail: { onlyProductId: String(editingId), forceCloudSync: true },
            })
          );
          console.log("✅ Variant changes auto-saved and synced to Supabase");
        }
      } catch (err) {
        console.error("❌ Failed to auto-save variant changes:", err);
      }
    };

    // Debounce the auto-save to avoid too many saves
    const timer = setTimeout(autoSaveVariants, 1000);
    return () => clearTimeout(timer);
  }, [variantConfig.combinations, editingId, variantGroups]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropping, setCropping] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [appliedAspectRatio, setAppliedAspectRatio] = useState(1);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isWhiteBg =
    imageBgOverride?.toLowerCase() === "white" ||
    imageBgOverride?.toLowerCase() === "#ffffff";

  const badgeBg = isWhiteBg ? "#fff" : "#000";
  const badgeText = isWhiteBg ? "#000" : "#fff";
  const badgeBorder = isWhiteBg
    ? "rgba(0, 0, 0, 0.4)"
    : "rgba(255, 255, 255, 0.4)";

  const getLighterColor = (color) => {
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

  // Helper function to check if there's any data to display in the preview
  const hasDataToDisplay = () => {
    const catData = getCatalogueFormData();

    // Check for basic fields
    if (formData.name || formData.subtitle) return true;

    // Check for price
    if (getSelectedCataloguePrice()) return true;

    // Check for badge
    if (catData.badge) return true;

    // Check for any field values
    const hasFieldValue = getAllFields()
      .filter(f => f.enabled && f.key.startsWith('field') && isFieldVisibleOnSurface(f, 'shareImage'))
      .some(field => {
        const val = catData[field.key];
        const visibilityKey = `${field.key}Visible`;
        const isVisible = catData[visibilityKey] !== false;
        return val && isVisible;
      });

    return hasFieldValue;
  };

  useEffect(() => {
    // Reset variant initialization flag when switching products
    isVariantConfigInitializedRef.current = false;

    if (editingId) {
      const products = safeGetFromStorage(productsStorageKey, []);
      const product = products.find((p) => p.id === editingId);
      if (product) {
        const migratedProduct = normalizeProductImageFields(
          migrateProductToNewFormat(product) as ProductWithCatalogueData
        ) as ProductWithCatalogueData;

        if (!migratedProduct.catalogueData) {
          migratedProduct.catalogueData = initializeCatalogueData(migratedProduct);
        }

        setFormData({
          id: migratedProduct.id || "",
          name: migratedProduct.name || "",
          subtitle: migratedProduct.subtitle || "",
          privateNotes: migratedProduct.privateNotes || "",
          category: Array.isArray(migratedProduct.category)
            ? migratedProduct.category
            : migratedProduct.category
            ? [migratedProduct.category]
            : [],
          catalogueData: migratedProduct.catalogueData,
        });

        setOverrideColor(migratedProduct.bgColor || "#d1b3c4");
        setFontColor(migratedProduct.fontColor || "white");
        setImageBgOverride(migratedProduct.imageBgColor || "white");
        setAppliedAspectRatio(migratedProduct.cropAspectRatio || 1);
        const groups = getProductVariantGroups(migratedProduct);
        setVariantGroups(groups);
        const variantsCfg = (migratedProduct.variants || {}) as ProductVariantsConfig;
        setVariantConfig(variantsCfg);

        // ✅ Restore saved color palette
if (migratedProduct.suggestedColors?.length > 0) {
  setSuggestedColors(migratedProduct.suggestedColors);
}

        const urlsFromProduct = getProductImageUrls(migratedProduct);
        const pi = getPrimaryImageIndex(migratedProduct);
        if (urlsFromProduct.length > 0) {
          setImageSlots(urlsFromProduct);
          setPrimarySlotIndex(Math.min(pi, urlsFromProduct.length - 1));
        } else {
          setImageSlots([]);
          setPrimarySlotIndex(0);
          const versionedCloudUrl =
            migratedProduct.imageUrl && typeof migratedProduct.imageUrl === "string"
              ? `${migratedProduct.imageUrl}${migratedProduct.imageUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(migratedProduct.imageVersion || ""))}`
              : "";
          if (versionedCloudUrl) {
            setImageSlots([versionedCloudUrl]);
            setPrimarySlotIndex(0);
          } else if (migratedProduct.image && migratedProduct.image.startsWith("data:image")) {
            setImageSlots([migratedProduct.image]);
            setPrimarySlotIndex(0);
          } else if (migratedProduct.imageUrl) {
            setImageSlots([migratedProduct.imageUrl]);
            setPrimarySlotIndex(0);
          } else if (migratedProduct.imagePath) {
            setImageFilePath(migratedProduct.imagePath);
            Filesystem.readFile({
              path: migratedProduct.imagePath,
              directory: Directory.External,
            })
              .then((res) => {
                setImageSlots([`data:image/png;base64,${res.data}`]);
                setPrimarySlotIndex(0);
              })
              .catch(async () => {
                try {
                  const res = await Filesystem.readFile({
                    path: migratedProduct.imagePath,
                    directory: Directory.Data,
                  });
                  setImageSlots([`data:image/png;base64,${res.data}`]);
                  setPrimarySlotIndex(0);
                } catch {
                  if (migratedProduct.imageUrl) {
                    setImageSlots([migratedProduct.imageUrl]);
                    setPrimarySlotIndex(0);
                  }
                }
              });
          }
        }
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        catalogueData: initializeCatalogueData(),
      }));
      setImageSlots([]);
      setPrimarySlotIndex(0);
    }
  }, [editingId]);

  const getCatalogueFormData = () => {
    return getCatalogueData(formData, selectedCatalogue);
  };

  const updateCatalogueData = (updates: Partial<CatalogueData>) => {
    setFormData((prev) => {
      const catId = selectedCatalogue;
      const prevRow = prev.catalogueData?.[catId] ?? getDefaultCatalogueData(catId);
      return {
        ...prev,
        catalogueData: {
          ...(prev.catalogueData ?? {}),
          [catId]: {
            ...prevRow,
            ...updates,
          },
        },
      };
    });
  };

  const isCatalogueEnabled = (catalogueId: string) => {
    return isProductEnabledForCatalogue(formData, catalogueId);
  };

  const toggleCatalogueEnabled = (catalogueId: string) => {
    setFormData((prev) => {
      const currentlyEnabled = isProductEnabledForCatalogue(prev, catalogueId);
      const newCatalogueData = { ...prev.catalogueData };

      newCatalogueData[catalogueId] = {
        ...(newCatalogueData[catalogueId] || {}),
        enabled: !currentlyEnabled
      };

      return {
        ...prev,
        catalogueData: newCatalogueData
      };
    });
  };

  const handleFetchFieldsChange = (checked: boolean) => {
    setFetchFieldsChecked(checked);

    if (!checked) {
      const updates: Partial<CatalogueData> = {
        badge: "",
      };
      for (let i = 1; i <= 10; i++) {
        updates[`field${i}`] = "";
        updates[`field${i}Unit`] = "None";
      }
      updateCatalogueData(updates);
      return;
    }

    const defaultCatalogueData = getCatalogueData(formData, 'cat1');
    const selectedCat = catalogues.find((c) => c.id === selectedCatalogue);

    if (!selectedCat) return;

    const updates: Partial<CatalogueData> = {
      badge: defaultCatalogueData.badge || "",
    };

    for (let i = 1; i <= 10; i++) {
      updates[`field${i}`] = defaultCatalogueData[`field${i}`] || "";
      updates[`field${i}Unit`] = defaultCatalogueData[`field${i}Unit`] || "None";
    }

    updateCatalogueData(updates);
    showToast(`Fields fetched from default catalogue to ${selectedCat.label}`, "success");
  };

  const handleFetchPriceChange = (checked: boolean) => {
    setFetchPriceChecked(checked);

    const selectedCat = catalogues.find((c) => c.id === selectedCatalogue);
    if (!selectedCat) return;

    if (!checked) {
      const updates: Partial<CatalogueData> = {
        [selectedCat.priceField]: "",
        [selectedCat.priceUnitField]: "/ piece",
        [offerPriceFieldFor(selectedCat.priceField)]: "",
        orderQuantityStep: 1,
        minimumOrderQuantity: 1,
        quantitySlabs: [],
      };
      updateCatalogueData(updates);
      return;
    }

    const defaultCatalogueData = getCatalogueData(formData, 'cat1');

    const defaultPriceField = catalogues.find((c) => c.id === 'cat1')?.priceField || 'price1';
    const defaultPriceUnitField = catalogues.find((c) => c.id === 'cat1')?.priceUnitField || 'price1Unit';
    const defaultOfferField = offerPriceFieldFor(defaultPriceField);

    const updates: Partial<CatalogueData> = {
      [selectedCat.priceField]: defaultCatalogueData[defaultPriceField] || "",
      [selectedCat.priceUnitField]: defaultCatalogueData[defaultPriceUnitField] || "/ piece",
      [offerPriceFieldFor(selectedCat.priceField)]:
        defaultCatalogueData[defaultOfferField] !== undefined && defaultCatalogueData[defaultOfferField] !== null
          ? String(defaultCatalogueData[defaultOfferField])
          : "",
          orderQuantityStep: defaultCatalogueData.orderQuantityStep ?? 1,
    };

    updateCatalogueData(updates);
    showToast(`Price & offer fetched from default catalogue to ${selectedCat.label}`, "success");
  };

  const getSelectedCataloguePriceField = () => {
    const selectedCat = catalogues.find((c) => c.id === selectedCatalogue);
    return selectedCat?.priceField || "price1";
  };

  const getSelectedCataloguePriceUnitField = () => {
    const selectedCat = catalogues.find((c) => c.id === selectedCatalogue);
    return selectedCat?.priceUnitField || "price1Unit";
  };

  const getSelectedCataloguePrice = () => {
    const priceField = getSelectedCataloguePriceField();
    return getCatalogueFormData()[priceField] || "";
  };

  const getSelectedCataloguePriceUnit = () => {
    const priceUnitField = getSelectedCataloguePriceUnitField();
    return getCatalogueFormData()[priceUnitField] || "/ piece";
  };

  const getSelectedCatalogueOfferField = () => offerPriceFieldFor(getSelectedCataloguePriceField());

  const getSelectedCatalogueOffer = () => {
    const f = getSelectedCatalogueOfferField();
    return getCatalogueFormData()[f] || "";
  };

  const removeImageAt = (index: number) => {
    setImageSlots((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const newPrimary = primaryIndexAfterSlotRemoved(index, primarySlotIndex, prev.length);
      setPrimarySlotIndex(newPrimary);
      return prev.filter((_, i) => i !== index);
    });
  };

  const openReplaceSlot = (index: number) => {
    cropModeRef.current = index;
    document.getElementById("fallback-file-input")?.click();
  };

  const handleSelectImage = async () => {
    if (imageSlots.length >= MAX_PRODUCT_IMAGES) {
      showToast(`You can add up to ${MAX_PRODUCT_IMAGES} images per product.`, "warning");
      return;
    }
    cropModeRef.current = "append";
    const defaultFolder = "Phone/Pictures/Photoroom";
    const folder = localStorage.getItem("lastUsedFolder") || defaultFolder;

    try {
      const res = await Filesystem.readdir({
        path: folder,
        directory: Directory.External,
      });

      const imageFile = res.files.find((f) =>
        f.name.match(/\.(jpg|jpeg|png|webp)$/i)
      );

      if (!imageFile) throw new Error("No image files found in folder");

      const fullPath = `${folder}/${imageFile.name}`;
      const fileData = await Filesystem.readFile({
        path: fullPath,
        directory: Directory.External,
      });

      const base64 = `data:image/png;base64,${fileData.data}`;
      setOriginalBase64(base64);
      setCropSessionPreview(base64);
      setCropping(true);

      localStorage.setItem("lastUsedFolder", folder);
    } catch (err) {
      console.warn("Fallback to system file picker:", err.message);
      document.getElementById("fallback-file-input").click();
    }
  };

  /**
   * Analyze image brightness using canvas sampling
   * Returns true if image is bright (light), false if dark
   */
  const getImageBrightness = (img: HTMLImageElement): boolean => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let r = 0, g = 0, b = 0;

      // Sample every 4th pixel (stride=4) for performance, instead of every pixel
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }

      // Calculate average
      const numPixels = data.length / 16;
      const avgR = r / numPixels;
      const avgG = g / numPixels;
      const avgB = b / numPixels;

      // Calculate luminance (perceptual brightness)
      // Using standard formula: 0.299*R + 0.587*G + 0.114*B
      const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB);

      // If luminance < 128 (on 0-255 scale), consider it bright
      return luminance < 128;
    } catch (error) {
      console.warn('[CatShare] Brightness detection error:', error);
      return false; // Default to dark if error
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        if (cropModeRef.current === "append" && imageSlotsRef.current.length >= MAX_PRODUCT_IMAGES) {
          showToast(`You can add up to ${MAX_PRODUCT_IMAGES} images per product.`, "warning");
          return;
        }

        if (file.webkitRelativePath || file.name) {
          const fakePath = file.webkitRelativePath || file.name;
          const folderPath = fakePath.substring(0, fakePath.lastIndexOf("/"));
          localStorage.setItem("lastUsedFolder", folderPath);
        }

        setOriginalBase64(base64Data);
        setCropSessionPreview(base64Data);
        setCropping(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const applyCrop = async () => {
    if (!cropSessionPreview || !croppedAreaPixels) return;
    try {
      const croppedBase64 = await getCroppedImg(
        cropSessionPreview,
        croppedAreaPixels
      );
      const mode = cropModeRef.current;
      setImageSlots((prev) => {
        if (mode === "append") {
          const next = [...prev, croppedBase64].slice(0, MAX_PRODUCT_IMAGES);
          if (prev.length === 0) {
            setTimeout(() => setPrimarySlotIndex(0), 0);
          }
          return next;
        }
        if (typeof mode === "number") {
          return prev.map((p, i) => (i === mode ? croppedBase64 : p));
        }
        return prev;
      });
      setAppliedAspectRatio(aspectRatio);
      setCropping(false);
      setCropSessionPreview(null);
      cropModeRef.current = null;
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (error) {
      console.error("Crop failed:", error);
    }
  };

  useEffect(() => {
    if (cardPreview) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = cardPreview;
      img.onload = () => {
        try {
          const palette = getPalette(img, 12);
          setSuggestedColors(palette);
        } catch (error) {
          console.warn('[CatShare] Palette extraction failed:', error);
        }

        // Auto-detect and set image background color based on brightness
        try {
          const isBright = getImageBrightness(img);
          const newBg = isBright ? 'transparent' : 'white';
          setImageBgOverride(newBg);
        } catch (error) {
          console.warn('[CatShare] Brightness detection failed:', error);
          // Default to white if detection fails
          setImageBgOverride('white');
        }
      };
      img.onerror = () => {
        console.warn('[CatShare] Image failed to load');
      };
    }
  }, [cardPreview]);

  useEffect(() => {
    setPreviewImageIndex(primarySlotIndex);
  }, [imageSlots, primarySlotIndex]);

  // Calculate and update scale when preview content changes
  const calculateScale = () => {
    const previewCard = previewCardRef.current;
    const previewContainer = previewContainerRef.current;
    if (!previewCard || !previewContainer) return;

    // Use requestAnimationFrame to ensure measurement after paint
    requestAnimationFrame(() => {
      const cardHeight = previewCard.offsetHeight;
      const containerHeight = previewContainer.offsetHeight;

      // Account for container padding (pt-[40px] = 40px, pb-2 = 8px) + extra margin
      const availableHeight = containerHeight - 64;

      if (cardHeight > 0 && containerHeight > 0) {
        if (cardHeight > availableHeight) {
          // Scale down to fit with safety margin
          const newScale = Math.max(0.2, availableHeight / cardHeight);
          setPreviewScale(newScale);
        } else {
          setPreviewScale(1);
        }
      }
    });
  };

  // Recalculate on window resize and content changes
  useEffect(() => {
    const previewCard = previewCardRef.current;
    if (!previewCard) return;

    let mutationTimeout: NodeJS.Timeout | null = null;

    const handleResize = () => {
      calculateScale();
    };

    // Watch for DOM changes in the preview card with debounce
    const mutationObserver = new MutationObserver(() => {
      if (mutationTimeout) clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        calculateScale();
      }, 50);
    });

    mutationObserver.observe(previewCard, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener('resize', handleResize);

    // Initial calculations with multiple checks
    const timer1 = setTimeout(() => calculateScale(), 50);
    const timer2 = setTimeout(() => calculateScale(), 150);
    const timer3 = setTimeout(() => calculateScale(), 300);

    return () => {
      window.removeEventListener('resize', handleResize);
      mutationObserver.disconnect();
      if (mutationTimeout) clearTimeout(mutationTimeout);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [previewCardRef]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const commonFields = ['id', 'name', 'subtitle', 'category', 'privateNotes'];

    if (commonFields.includes(name)) {
      setFormData((prev) => ({ ...prev, [name]: value }));
      return;
    }
    if (isCataloguePriceOrOfferFieldName(name)) {
      updateCatalogueData({ [name]: sanitizeDecimalPriceInput(value) });
      return;
    }
    updateCatalogueData({ [name]: value });
  };

  const offerVersusPriceError = getOfferVersusPriceValidationError(
    getSelectedCataloguePrice(),
    getSelectedCatalogueOffer()
  );

  const saveAndNavigate = async () => {
    // Prevent multiple rapid clicks
    if (isSaving) {
      return;
    }

    if (authUserId && !guardCloudWrite()) return;

    if (!cardPreview || imageSlots.length === 0) {
      showToast("Please upload and crop at least one image before saving.", "warning");
      return;
    }

    const offerErr = getOfferVersusPriceValidationError(
      getSelectedCataloguePrice(),
      getSelectedCatalogueOffer()
    );
    if (offerErr) {
      showToast(offerErr, "error");
      return;
    }

    if (!editingId && !isPro) {
      const count = getAllProducts(authUserId || undefined).length;
      if (count >= FREE_MAX_PRODUCTS) {
        showToast(
          `Free plan allows up to ${FREE_MAX_PRODUCTS} products. Delete a product or upgrade to Pro for unlimited.`,
          "warning"
        );
        return;
      }
    }

    setIsSaving(true);
    const id = editingId || Date.now().toString();
    // Re-read user id at the time of saving to avoid timing issues
    // when the auth/localStorage value is still being populated.
    const authUserIdNow = getPersistedAuthUserId();
    const productsStorageKeyNow = authUserIdNow
      ? getStorageKey("products", authUserIdNow)
      : "products";
    const useUserImagesNow = Boolean(authUserIdNow);

    const imagePath = useUserImagesNow
      ? getUserImagePath(id, authUserIdNow || undefined)
      : `catalogue/product-${id}.png`;

    const primIx = Math.min(primarySlotIndex, Math.max(0, imageSlots.length - 1));
    const primaryPreview = imageSlots[primIx] ?? imageSlots[0];

    try {
      if (primaryPreview?.startsWith("data:image")) {
        const base64 = primaryPreview.split(",")[1];
        await Filesystem.writeFile({
          path: imagePath,
          data: base64,
          // Save to External so user-* folders are visible under android/data/.../files
          directory: Directory.External,
          recursive: true,
        });
        console.log("📂 Saved product source image to:", imagePath);
      }
    } catch (err) {
      setIsSaving(false);
      showToast("Image save failed: " + err.message, "error");
      return;
    }

    const existingProduct = editingId
      ? safeGetFromStorage(productsStorageKeyNow, []).find((p: any) => p.id === editingId)
      : undefined;

    const stripQuery = (u: string) => {
      const s = String(u || "").trim();
      const i = s.indexOf("?");
      return i === -1 ? s : s.slice(0, i);
    };

    const imageUrls: string[] = [];
    for (let i = 0; i < imageSlots.length; i++) {
      const slot = imageSlots[i];
      if (slot.startsWith("http")) {
        imageUrls.push(slot.trim());
      } else if (slot.startsWith("data:image")) {
        try {
          const uploaded = await uploadProductImageToR2({ productId: id, dataUrl: slot });
          if (uploaded?.url) {
            imageUrls.push(uploaded.url);
          } else {
            setIsSaving(false);
            showToast("Image upload failed: invalid response.", "error");
            return;
          }
        } catch (err: any) {
          setIsSaving(false);
          showToast(
            err?.message || "Could not upload image. Check your connection and try again.",
            "error"
          );
          return;
        }
      }
    }

    const imageFields = buildProductImagePersistFields({
      imageUrls,
      primaryImageIndex: primIx,
    });
    let imageVersion: number | undefined = imageFields.imageVersion;
    if (imageVersion == null && typeof existingProduct?.imageVersion === "number" && Number.isFinite(existingProduct.imageVersion)) {
      const prevPrimary = stripQuery(String(existingProduct.imageUrl || ""));
      if (prevPrimary && prevPrimary === stripQuery(String(imageFields.imageUrl || ""))) {
        imageVersion = existingProduct.imageVersion;
      }
    }
    if (imageVersion == null && typeof imageFields.imageUrl === "string" && imageFields.imageUrl.startsWith("http")) {
      imageVersion = Date.now();
    }

    const defaultCatalogueData = getCatalogueData(formData, 'cat1');
    const allCatalogues = getAllCatalogues();

    const newItem: ProductWithCatalogueData = {
      ...formData,
      id,
      imagePath,
      ...imageFields,
      ...(typeof imageVersion === "number" && Number.isFinite(imageVersion) ? { imageVersion } : {}),
      updatedAt: new Date().toISOString(),
      suggestedColors: suggestedColors.length > 0 ? suggestedColors : undefined,
      fontColor: fontColor || "white",
      imageBgColor: imageBgOverride || "white",
      bgColor: overrideColor || "#add8e6",
      cropAspectRatio: appliedAspectRatio,
      renderingType: "classic",
    };

    if (newItem.catalogueData) {
      for (const cat of allCatalogues) {
        const row = newItem.catalogueData[cat.id];
        if (!row) continue;
        const slabs = normalizeQuantitySlabs(row.quantitySlabs);
        newItem.catalogueData[cat.id] = {
          ...row,
          quantitySlabs: slabs.length > 0 ? slabs : undefined,
        };
      }
    }

    const savedVariants = pruneVariantGroupsForSave(variantGroups);
    if (variantConfig.combinations && variantConfig.combinations.length > 0) {
      savedVariants.combinations = variantConfig.combinations;
    }
    if (savedVariants.groups.length > 0) {
      newItem.variants = savedVariants;
    } else {
      delete newItem.variants;
    }

    if (newItem.image) {
      delete newItem.image;
    }

    for (const cat of allCatalogues) {
      const catData = getCatalogueData(formData, cat.id);
      newItem[cat.priceField] = catData[cat.priceField] || "";
      newItem[cat.priceUnitField] = catData[cat.priceUnitField] || "/ piece";
      newItem[offerPriceFieldFor(cat.priceField)] = catData[offerPriceFieldFor(cat.priceField)] || "";
      newItem[cat.stockField] = catData[cat.stockField] !== false;
    }

    newItem.price1 = newItem.price1 || "";
    newItem.price1Unit = newItem.price1Unit || "/ piece";

    for (let i = 1; i <= 10; i++) {
      newItem[`field${i}`] = defaultCatalogueData[`field${i}`] || "";
      newItem[`field${i}Unit`] = defaultCatalogueData[`field${i}Unit`] || "None";
    }

    newItem.badge = defaultCatalogueData.badge || "";
    newItem.wholesaleUnit = defaultCatalogueData.price1Unit || "/ piece";
    newItem.packageUnit = defaultCatalogueData.field2Unit || "pcs / set";
    newItem.ageUnit = defaultCatalogueData.field3Unit || "months";
    newItem.wholesale = newItem.price1 || "";
    newItem.stock = newItem[allCatalogues[0]?.stockField || "wholesaleStock"] !== false;

    try {
      const all = safeGetFromStorage(productsStorageKeyNow, []);
      const isNewProduct = !editingId;
      const updated = editingId
        ? all.map((p) => (p.id === editingId ? newItem : p))
        : [...all, newItem];

      const ok = safeSetInStorage(productsStorageKeyNow, updated);
      if (!ok) {
        setIsSaving(false);
        showToast(
          "Product save failed: local storage quota exceeded. Please sync or clear old offline products.",
          "error"
        );
        return;
      }

      if (isNewProduct) {
        logProductAdded(updated.length);
      }

      window.dispatchEvent(
        new CustomEvent("product-added", {
          detail: { onlyProductId: String(newItem.id), forceCloudSync: true },
        })
      );

      const totalProducts = updated.length;
      const isRatingMilestone = (count: number): boolean => {
        let milestone = 10;
        let increment = 15;
        while (milestone < count) {
          milestone += increment;
          increment += 5;
        }
        return count === milestone;
      };
      const shouldShowRating = isRatingMilestone(totalProducts);

      const isCatalogueId = fromParam && catalogues.some((c) => c.id === fromParam);
      const basePath = isCatalogueId ? `/catalogues?catalogue=${fromParam}` : "/";
      const navigationPath = shouldShowRating
        ? `${basePath}${basePath.includes('?') ? '&' : '?'}showRating=true&productCount=${totalProducts}`
        : basePath;

      // Navigate immediately without waiting for background tasks
      navigate(navigationPath);
      setIsSaving(false);

      // PNG rendering in background (R2 upload already completed when preview was data:image)
      (async () => {
        try {
          // Render PNG images in background
          try {
            const enabledCats = catalogues.filter(cat => isCatalogueEnabled(cat.id));
            for (const cat of enabledCats) {
              const catData = getCatalogueData(newItem, cat.id);
              const renderOptions: any = {
                catalogueId: cat.id,
                catalogueLabel: cat.label,
                folder: cat.folder || cat.label,
                priceField: cat.priceField,
                priceUnitField: cat.priceUnitField,
                price1Unit: catData.price1Unit || "/ piece",
                wholesaleUnit: catData.price1Unit || "/ piece",
              };

              for (let i = 1; i <= 10; i++) {
                renderOptions[`field${i}Unit`] = catData[`field${i}Unit`] || "None";
              }

              const legacyType = cat.id === "cat1" ? "wholesale" : cat.id === "cat2" ? "resell" : cat.id;
              await saveRenderedImage(newItem, legacyType, renderOptions);
            }
          } catch (err) {
            console.warn("⏱️ PNG render failed in background:", err);
          }
        } catch (err) {
          console.error("Background tasks failed:", err);
        }
      })();
    } catch (err) {
      setIsSaving(false);
      showToast("Product save failed: " + err.message, "error");
    }
  };

  const handleCancel = () => {
    const isCatalogueId = fromParam && catalogues.some((c) => c.id === fromParam);
    const navigationPath = isCatalogueId ? `/catalogues?catalogue=${fromParam}` : "/";
    navigate(navigationPath);
  };

  if (cropping && cropSessionPreview) {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
        <div className="fixed top-0 left-0 right-0 h-[40px] bg-black z-50"></div>
        <div className="h-[40px]"></div>
        <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center justify-center px-4">
          <h1 className="text-xl font-bold">Crop Image</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Crop Image</h2>
              <p className="text-gray-500 text-xs">Adjust your product image to the perfect dimensions</p>
            </div>

            <div className="flex gap-2 mb-4 justify-center">
              <button
                onClick={() => setAspectRatio(1)}
                className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  aspectRatio === 1
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-400"
                }`}
              >
                Square
              </button>
              <button
                onClick={() => setAspectRatio(3 / 4)}
                className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  aspectRatio === 3 / 4
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-400"
                }`}
              >
                Portrait
              </button>
            </div>

            <div className="mb-4 rounded-lg overflow-hidden shadow-md border-2 border-blue-200 bg-white">
              <div style={{ height: 300, position: "relative" }}>
                <Cropper
                  image={cropSessionPreview}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectRatio}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={applyCrop}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md transition-all"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setCropping(false);
                  setCropSessionPreview(null);
                  cropModeRef.current = null;
                }}
                className="bg-gray-200 text-gray-700 font-semibold px-6 py-2 rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-black overflow-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5px)' }}>
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 h-[40px] bg-black z-50"></div>

      {/* Header below status bar */}
      <div className="fixed top-[40px] left-0 right-0 h-12 bg-black/50 z-40 flex items-center justify-end px-4">
        <button
          onClick={() => navigate('/')}
          className="text-white/40 hover:text-white/70 transition-colors flex items-center justify-center w-6 h-6"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Image Preview Section with Product Card */}
      <div
        ref={previewContainerRef}
        className="flex-1 flex items-center justify-center overflow-y-auto overflow-x-hidden pt-[88px] pb-2 relative"
      >
        <motion.div
          className="relative flex items-center justify-center"
          style={{ opacity: imageOpacity }}
        >
          {cardPreview && (
            <motion.div
              ref={previewCardRef}
              style={{
                width: "95%",
                maxWidth: `${currentTheme.rendering.cardWidth}px`,
                backgroundColor: "white",
                borderRadius: `${currentTheme.rendering.cardBorderRadius}px`,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                scale: finalScale,
                transformOrigin: "center",
              }}
            >
              {/* Product Image - Swipeable Gallery */}
              <div
                style={{
                  position: "relative",
                  backgroundColor: imageBgOverride,
                  textAlign: "center",
                  padding: 0,
                  aspectRatio: appliedAspectRatio,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  overflow: "hidden",
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={previewImageIndex}
                    src={imageSlots[previewImageIndex]}
                    alt="Preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      margin: "0 auto",
                    }}
                  />
                </AnimatePresence>

                {imageSlots.length > 1 && (
                  <>
                    <button
                      onClick={() => setPreviewImageIndex((prev) => (prev === 0 ? imageSlots.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all z-10"
                      style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPreviewImageIndex((prev) => (prev === imageSlots.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all z-10"
                      style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 12,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        color: "white",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      {previewImageIndex + 1} / {imageSlots.length}
                    </div>
                  </>
                )}

                {showWatermark && (
                  <div
                    style={{
                      ...getWatermarkPositionStyles(watermarkPosition),
                      fontSize: "10px",
                      color: imageBgOverride?.toLowerCase() === "white" || imageBgOverride?.toLowerCase() === "#ffffff"
                        ? "rgba(0, 0, 0, 0.25)"
                        : "rgba(255, 255, 255, 0.4)",
                      letterSpacing: "0.3px"
                    }}
                  >
                    {watermarkText}
                  </div>
                )}

                {getCatalogueFormData().badge && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      backgroundColor: badgeBg,
                      color: badgeText,
                      fontSize: 13,
                      fontWeight: 400,
                      padding: "6px 10px",
                      borderRadius: "999px",
                      opacity: 0.95,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      border: `1px solid ${badgeBorder}`,
                      letterSpacing: "0.5px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {getCatalogueFormData().badge.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Product Details Section */}
              {hasDataToDisplay() && (
                <>
                  <div
                    style={{
                      backgroundColor: getLighterColor(overrideColor),
                      color: fontColor || "white",
                      padding: "10px",
                    }}
                  >
                    {formData.name && (
                      <h2 className="text-lg font-semibold text-center">{formData.name}</h2>
                    )}
                    {formData.subtitle && (
                      <p className="text-center italic text-xs mt-0.5">({formData.subtitle})</p>
                    )}
                    <div className="text-sm mt-2 space-y-1">
                      {getAllFields()
                        .filter(f => f.enabled && f.key.startsWith('field') && isFieldVisibleOnSurface(f, 'shareImage'))
                        .map(field => {
                          const catData = getCatalogueFormData();
                          const val = catData[field.key];
                          const visibilityKey = `${field.key}Visible`;
                          const isVisible = catData[visibilityKey] !== false;

                          if (!val || !isVisible) return null;
                          const unit = catData[`${field.key}Unit`];
                          const displayUnit = unit && unit !== "None" ? unit : "";

                          return (
                            <p key={field.key} className="flex gap-2">
                              <span className="min-w-[80px]">{field.label}</span>
                              <span>:</span>
                              <span>{val} {displayUnit}</span>
                            </p>
                          );
                        })}
                    </div>
                  </div>

                  {/* Price Section */}
                  {(getSelectedCataloguePrice() || getSelectedCatalogueOffer()) && (() => {
                    const pf = getSelectedCataloguePriceField();
                    const r = resolveListOfferEffective(getCatalogueFormData(), pf, formData as unknown as Record<string, unknown>);
                    const u = getSelectedCataloguePriceUnit();
                    const unitDisp = u && u !== "None" ? u : "";
                    return (
                    <div
                      style={{
                        backgroundColor: overrideColor,
                        color: fontColor === "white" ? "white" : "black",
                        padding: "8px 6px",
                        textAlign: "center",
                        fontWeight: "600",
                        fontSize: "16px",
                      }}
                    >
                      Price:{" "}
                      {r.showStrikeout ? (
                        <>
                          {currencySymbol}{r.offerPrice}
                          <span style={{ ...STRUCK_LIST_PRICE_STYLE, marginLeft: 8 }}>{currencySymbol}{r.listPrice}</span>
                          {unitDisp ? ` ${unitDisp}` : ""}
                        </>
                      ) : (
                        <>
                          {currencySymbol}{r.effectiveUnitPrice || getSelectedCataloguePrice()}
                          {unitDisp ? ` ${unitDisp}` : ""}
                        </>
                      )}
                    </div>
                    );
                  })()}
                </>
              )}
            </motion.div>
          )}

          {!cardPreview && (
            <button
              onClick={handleSelectImage}
              className="text-center text-gray-400 select-none hover:text-gray-300 transition-colors cursor-pointer"
            >
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Click to select an image</p>
            </button>
          )}
        </motion.div>
      </div>

      {/* Draggable Bottom Sheet */}
      <motion.div
        onPanStart={() => setIsDragging(true)}
        onPan={(_, info) => {
          // Allow dragging (up/down) from any scroll position
          const newY = Math.max(0, Math.min(DRAG_RANGE, y.get() + info.delta.y));
          y.set(newY);
        }}
        onPanEnd={handleDragEnd}
        className="bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col select-none"
        style={{
          height: sheetHeight,
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
          willChange: "height",
        }}
      >
        {/* Drag Handle - Extended to full width */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between select-none w-full pointer-events-none">
          {/* Drag Handle Icon */}
          <div className="mx-auto flex items-center justify-center hover:opacity-70 transition-opacity py-1">
            <motion.svg
              className="w-5 h-5 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ rotate: arrowRotate }}
            >
              <path d="M5 15l7-7 7 7" />
            </motion.svg>
          </div>
        </div>

        {/* Header inside sheet */}
        <header className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between select-none">
          <h1 className="text-base font-bold">{editingId ? "Edit Product" : "Create Product"}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectImage}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-md text-xs flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Change
            </button>
          </div>
        </header>

        {/* Form Tabs */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex gap-2">
          <button
            onClick={() => setFormSection('basic')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              formSection === 'basic'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            Basic Info
          </button>
          <button
            onClick={() => setFormSection('catalogue')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              formSection === 'catalogue'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setFormSection('variants')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              formSection === 'variants'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            Variants
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          onScroll={handleScrollCheck}
          className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 text-sm"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5px)',
          }}
        >
          {formSection === 'basic' && (
            <>
              {/* Product Name & Subtitle */}
              <div className="mb-5 space-y-4 pb-4 border-b border-gray-200 dark:border-gray-800">
            <div className="relative">
              <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-gray-400">
                Model Name
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="border border-gray-300 dark:border-gray-700 p-2 rounded w-full text-sm bg-white dark:bg-gray-800"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold mb-1.5 text-gray-600 dark:text-gray-400">
                Subtitle
              </label>
              <input
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                className="border border-gray-300 dark:border-gray-700 p-2 rounded w-full text-sm bg-white dark:bg-gray-800"
              />
              </div>
            </div>

              <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Gallery
                    </label>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {imageSlots.length} of {MAX_PRODUCT_IMAGES} images
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {imageSlots.map((src, idx) => (
                    <div key={`slot-${idx}`} className="relative">
                      <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 transition-all duration-200"
                        style={{
                          borderColor: primarySlotIndex === idx ? '#2563eb' : '#e5e7eb',
                        }}
                      >
                        <img src={src} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />

                        {primarySlotIndex === idx && (
                          <div className="absolute inset-0 bg-blue-600/10 pointer-events-none flex items-center justify-center">
                            <div className="bg-blue-600 text-white rounded-full p-1" style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Menu Button */}
                      <button
                        type="button"
                        onClick={() => setOpenMenuIdx(openMenuIdx === idx ? null : idx)}
                        className="absolute -top-2 -right-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                        title="More actions"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.5 1.5H9.5V.5h1v1zm0 5H9.5v-1h1v1zm0 5H9.5v-1h1v1zm0 5H9.5v-1h1v1z" />
                        </svg>
                      </button>

                      {/* Mobile-Friendly Dropdown Menu */}
                      {openMenuIdx === idx && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-10 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                          style={{ minWidth: '140px' }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setPrimarySlotIndex(idx);
                              setOpenMenuIdx(null);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${
                              primarySlotIndex === idx
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Primary
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openReplaceSlot(idx);
                              setOpenMenuIdx(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeImageAt(idx);
                              setOpenMenuIdx(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </button>
                        </motion.div>
                      )}

                      {/* Index Badge */}
                      <div className="absolute -bottom-2 -left-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                  {imageSlots.length < MAX_PRODUCT_IMAGES && (
                    <button
                      type="button"
                      onClick={handleSelectImage}
                      className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Colors Section */}
              <div className="space-y-3 mb-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setShowColorPicker(true)}
                  className="flex items-center gap-2 w-full border rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: overrideColor,
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <span className="text-xs">BG: {formatToHex(overrideColor)}</span>
                </button>

                {suggestedColors.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Suggested Colors:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {suggestedColors.map((color) => (
                        <div
                          key={color}
                          onClick={() => setOverrideColor(color)}
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: color,
                            border: overrideColor === color ? "2px solid blue" : "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <label className="flex items-center gap-1 text-xs">
                    Font:
                    {["white", "black"].map((color) => (
                      <div
                        key={color}
                        onClick={() => setFontColor(color)}
                        style={{
                          width: 20,
                          height: 20,
                          backgroundColor: color,
                          border: fontColor === color ? "2px solid blue" : "1px solid #ccc",
                          borderRadius: "50%",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </label>

                  <label className="flex items-center gap-1 text-xs">
                    Badge:
                    {["white", "transparent"].map((color) => (
                      <div
                        key={color}
                        onClick={() => setImageBgOverride(color)}
                        style={{
                          width: 20,
                          height: 20,
                          backgroundColor: color === "transparent" ? "#f0f0f0" : color,
                          border: imageBgOverride === color ? "2px solid blue" : "1px solid #ccc",
                          borderRadius: "50%",
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {color === "transparent" && (
                          <div style={{
                            position: "absolute",
                            width: "100%",
                            height: "2px",
                            backgroundColor: "#999",
                            top: "50%",
                            left: 0,
                            transform: "translateY(-50%) rotate(-45deg)",
                          }} />
                        )}
                      </div>
                    ))}
                  </label>
                </div>
              </div>

              {/* Categories */}
              <div className="mb-5">
                <label className="block text-xs font-semibold mb-3 text-gray-600 dark:text-gray-400">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {categoryList.map((cat) => {
                    const isSelected = formData.category.includes(cat);
                    return (
                      <div
                        key={cat}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            category: isSelected
                              ? prev.category.filter((c) => c !== cat)
                              : [...prev.category, cat],
                          }));
                        }}
                        className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {cat}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {!categoryAddOpen ? (
                    <button
                      type="button"
                      onClick={() => setCategoryAddOpen(true)}
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-dashed border-gray-300 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
                    >
                      <span className="text-[13px] leading-none">+</span>
                      Add
                    </button>
                  ) : (
                    <div className="flex min-w-0 w-full max-w-md items-center gap-1">
                      <input
                        ref={categoryInputRef}
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCategory();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setNewCategoryName("");
                            setCategoryAddOpen(false);
                          }
                        }}
                        placeholder="New category"
                        className="min-w-0 flex-1 appearance-none rounded-none border-0 border-b border-gray-300 bg-transparent py-1.5 text-sm text-gray-900 shadow-none placeholder:text-gray-400 outline-none ring-0 focus:border-blue-500 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-gray-100 dark:focus:border-blue-400"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="shrink-0 p-1 text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        aria-label="Save category"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCategoryName("");
                          setCategoryAddOpen(false);
                        }}
                        className="shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label="Cancel"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Private Notes */}
              <div className="mb-5">
                <label className="block text-xs font-semibold mb-3 text-gray-600 dark:text-gray-400">Private Notes (Secret)</label>
                <textarea
                  name="privateNotes"
                  value={formData.privateNotes}
                  onChange={handleChange}
                  placeholder="Add secret notes about this product..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 min-h-[100px] resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1.5 italic">These notes are only visible to you and won't be shared or shown on previews.</p>
              </div>
            </>
          )}

          {formSection === 'catalogue' && (
            <>
              {/* Catalogue Selector */}
              <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                <label className="block text-xs font-semibold mb-3 text-gray-600 dark:text-gray-400">Catalogues</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {catalogues.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCatalogue(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        selectedCatalogue === cat.id
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 scale-105"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm hover:bg-blue-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Toggle and Fill Options */}
              <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Catalogue Name with Details Label - Only show when enabled */}
                  {isCatalogueEnabled(selectedCatalogue) && (
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {catalogues.find(c => c.id === selectedCatalogue)?.label || selectedCatalogue} Details :
                    </span>
                  )}

                  {/* Fill Fields Checkbox */}
                  {isCatalogueEnabled(selectedCatalogue) && selectedCatalogue !== 'cat1' && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fetchFieldsChecked}
                        onChange={(e) => handleFetchFieldsChange(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Fill Fields
                      </span>
                    </label>
                  )}

                  {/* Fill Price Checkbox */}
                  {isCatalogueEnabled(selectedCatalogue) && selectedCatalogue !== 'cat1' && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fetchPriceChecked}
                        onChange={(e) => handleFetchPriceChange(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Fill Price
                      </span>
                    </label>
                  )}

                  {/* Show/Hide Button */}
                  <button
                    onClick={() => toggleCatalogueEnabled(selectedCatalogue)}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                      isCatalogueEnabled(selectedCatalogue)
                        ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    <span className="transition-transform">
                      {isCatalogueEnabled(selectedCatalogue) ? "✓" : "○"}
                    </span>
                    {isCatalogueEnabled(selectedCatalogue) ? "Show" : "Hide"}
                  </button>
                </div>
              </div>

              {/* Catalogue Details */}
              {isCatalogueEnabled(selectedCatalogue) && (
                <div className="space-y-4 mb-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                  {/* Reminder Message */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
                    </svg>
                    <span className="text-xs text-blue-800 dark:text-blue-200">
                      These fields can be customized in settings
                    </span>
                  </div>

                  {getAllFields()
                    .filter(f => f.enabled && f.key.startsWith('field'))
                    .map(field => {
                      const catData = getCatalogueFormData();
                      return (
                        <div key={field.key} className="flex gap-3 items-center">
                          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
                            {field.label}
                          </label>
                          <div className="relative flex-1">
                            <input
                              name={field.key}
                              value={catData[field.key] || ""}
                              onChange={handleChange}
                              className="border border-gray-300 dark:border-gray-700 p-2 w-full rounded text-xs bg-white dark:bg-gray-800"
                            />
                          </div>
                          {(field.unitsEnabled && field.unitOptions && field.unitOptions.length > 0) && (
                            <div className="relative flex-shrink-0">
                              <select
                                name={`${field.key}Unit`}
                                value={catData[`${field.key}Unit`] || "None"}
                                onChange={handleChange}
                                className="border border-gray-300 dark:border-gray-700 p-2 rounded min-w-[100px] text-xs appearance-none bg-white dark:bg-gray-800"
                              >
                                <option>None</option>
                                {field.unitOptions.map(opt => (
                                  <option key={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  <div className="flex gap-3 items-center">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
                      Price
                    </label>
                    <div className="relative flex-1">
                      <input
                        name={getSelectedCataloguePriceField()}
                        value={getSelectedCataloguePrice()}
                        onChange={handleChange}
                        inputMode="decimal"
                        autoComplete="off"
                        className="border border-gray-300 dark:border-gray-700 p-2 w-full rounded text-xs bg-white dark:bg-gray-800"
                      />
                    </div>
                    {getPriceUnits().length > 0 && (
                      <div className="relative flex-shrink-0">
                        <select
                          name={getSelectedCataloguePriceUnitField()}
                          value={getSelectedCataloguePriceUnit() || "None"}
                          onChange={handleChange}
                          className="border border-gray-300 dark:border-gray-700 p-2 rounded min-w-[100px] text-xs appearance-none bg-white dark:bg-gray-800"
                        >
                          <option>None</option>
                          {getPriceUnits().map(opt => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 items-start">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
                      Offer
                    </label>
                    <div className="relative flex-1 min-w-0">
                      <input
                        name={getSelectedCatalogueOfferField()}
                        value={getSelectedCatalogueOffer()}
                        onChange={handleChange}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Optional — lower than Price"
                        aria-invalid={offerVersusPriceError ? true : undefined}
                        className={`border p-2 w-full rounded text-xs bg-white dark:bg-gray-800 placeholder:text-gray-400 ${
                          offerVersusPriceError
                            ? "border-red-500 ring-1 ring-red-500/30 dark:border-red-500"
                            : "border-gray-300 dark:border-gray-700"
                        }`}
                      />
                      {offerVersusPriceError ? (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 leading-snug">
                          {offerVersusPriceError}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2 flex items-center gap-1">
                      Qty step
                      <InfoTooltip content="1 = any quantity. E.g. 12 → only 12, 24, 36… on the order form (per catalogue)." />
                    </label>
                    <div className="flex-1 min-w-0">
                      <OrderQuantityStepInput
                        name="orderQuantityStep"
                        value={getCatalogueFormData().orderQuantityStep ?? 1}
                        onCommit={(n) => updateCatalogueData({ orderQuantityStep: n })}
                        className="border border-gray-300 dark:border-gray-700 p-2 w-full max-w-[120px] rounded text-xs bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2 flex items-center gap-1">
                      MOQ
                      <InfoTooltip content="1 = no extra minimum. E.g. 50 → buyers must order at least 50 (rounded to qty step)." />
                    </label>
                    <div className="flex-1 min-w-0">
                      <MinimumOrderQuantityInput
                        name="minimumOrderQuantity"
                        value={getCatalogueFormData().minimumOrderQuantity ?? 1}
                        onCommit={(n) => updateCatalogueData({ minimumOrderQuantity: n })}
                        className="border border-gray-300 dark:border-gray-700 p-2 w-full max-w-[120px] rounded text-xs bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
                      Slab pricing
                    </label>
                    <div className="flex-1 min-w-0">
                      <QuantitySlabEditor
                        key={selectedCatalogue}
                        theme="classic"
                        value={getCatalogueFormData().quantitySlabs}
                        onChange={(slabs) => updateCatalogueData({ quantitySlabs: slabs })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 items-center">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
                      Badge
                    </label>
                    <div className="relative flex-1">
                      <input
                        name="badge"
                        value={getCatalogueFormData().badge || ""}
                        onChange={handleChange}
                        className="border border-gray-300 dark:border-gray-700 p-2 rounded w-full text-xs bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {!isCatalogueEnabled(selectedCatalogue) && (
                <div className="text-center text-gray-500 text-xs py-3 border-b border-gray-200 dark:border-gray-800 mb-5">
                  Enable this catalogue first
                </div>
              )}
            </>
          )}

          {formSection === 'variants' && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Product variants
                </h3>
                {variantGroups.length > 0 && (
                  <button
                    onClick={() => {
                      setVariantConfig({ ...variantConfig, groups: variantGroups });
                      setShowVariantDetailsModal(true);
                    }}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-2 px-4 rounded-lg text-xs font-semibold shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Manage Details
                  </button>
                )}
              </div>
              <ProductVariantsEditor
                groups={variantGroups}
                onChange={setVariantGroups}
                theme="classic"
              />
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={saveAndNavigate}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded w-full text-xs font-medium transition-colors"
            >
              {isSaving ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update" : "Save")}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-700 py-2.5 px-4 rounded w-full text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>

      <input
        type="file"
        id="fallback-file-input"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />

      {showColorPicker && (
        <ColorPickerModal
          value={overrideColor}
          onChange={(color) => {
            setOverrideColor(color);
            setShowColorPicker(false);
          }}
          onClose={() => setShowColorPicker(false)}
        />
      )}

      {/* Variant Details Modal */}
      {showVariantDetailsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Variant Details
              </h2>
              <button
                onClick={() => setShowVariantDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
            <VariantCombinationEditor
  variantConfig={{
    groups: variantGroups,
    combinations: variantConfig.combinations,
  }}
  onChange={(updated) => setVariantConfig(updated)}
  theme="classic"
  onSave={(updatedConfig) => {
    if (!editingId) return;
    const authUserIdNow = getPersistedAuthUserId();
    if (!authUserIdNow) return;
    const productsStorageKeyNow = getStorageKey("products", authUserIdNow);
    const all = safeGetFromStorage(productsStorageKeyNow, []);
    const updated = all.map((p: any) => {
      if (p.id !== editingId) return p;
      const savedVariants = pruneVariantGroupsForSave(variantGroups);
      savedVariants.combinations = updatedConfig.combinations ?? [];
      return { ...p, variants: savedVariants, updatedAt: new Date().toISOString() };
    });
    safeSetInStorage(productsStorageKeyNow, updated);
    window.dispatchEvent(
      new CustomEvent("product-added", {
        detail: { onlyProductId: String(editingId), forceCloudSync: true },
      })
    );
  }}
/>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setShowVariantDetailsModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 px-4 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
