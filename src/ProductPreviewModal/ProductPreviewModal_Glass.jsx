import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { FiX, FiShare2, FiCheckCircle, FiAlertCircle, FiEdit3, FiPackage, FiArchive } from "react-icons/fi";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { getCatalogueData } from "../config/catalogueProductUtils";
import { getAllCatalogues } from "../config/catalogueConfig";
import { getFieldConfig, getAllFields, isFieldVisibleOnSurface } from "../config/fieldConfig";
import { safeGetFromStorage } from "../utils/safeStorage";
import { useSubscription } from "../context/SubscriptionContext";
import {
  getEffectiveWatermarkText,
  getEffectiveWatermarkPosition,
} from "../utils/freeTierWatermark";
import { getCurrentCurrencySymbol, onCurrencyChange } from "../utils/currencyUtils";

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

// Helper function to adjust watermark position for Glass theme
const getGlassThemeWatermarkPosition = (position) => {
  const baseStyles = {
    position: "absolute",
    fontFamily: "Arial, sans-serif",
    fontWeight: 500,
    pointerEvents: "none",
    zIndex: 10
  };

  const isBottom = position?.startsWith('bottom');

  // For bottom positions, we place it at the very bottom of the card
  // For other positions, we keep it in the image section
  const glassPositionMap = {
    "top-left": { top: 10, left: 10, transform: "none" },
    "top-center": { top: 10, left: "50%", transform: "translateX(-50%)" },
    "top-right": { top: 10, right: 10, left: "auto", transform: "none" },
    "middle-left": { top: "50%", left: 10, transform: "translateY(-50%)" },
    "middle-center": { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
    "middle-right": { top: "50%", right: 10, left: "auto", transform: "translateY(-50%)" },
    "bottom-left": { bottom: isBottom ? 6 : 30, left: 10, transform: "none" },
    "bottom-center": { bottom: isBottom ? 6 : 30, left: "50%", transform: "translateX(-50%)" },
    "bottom-right": { bottom: isBottom ? 6 : 30, right: 10, left: "auto", transform: "none" }
  };

  const selectedPosition = glassPositionMap[position] || glassPositionMap["bottom-left"];
  return { ...baseStyles, ...selectedPosition };
};

/**
 * ProductPreviewModal_Glass
 * Glass theme version with glass morphism card design
 * Features: Gradient background, frosted glass effect, centered content box
 */
export default function ProductPreviewModal_Glass({
  product,
  tab,
  catalogueId: externalCatalogueId,
  onClose,
  onEdit,
  onToggleStock,
  onSwipeLeft,
  onSwipeRight,
  onShelf,
  filteredProducts = [],
}) {
  const { showToast } = useToast();
  const { currentTheme } = useTheme();
  const { isPro } = useSubscription();

  // Helper to darken color for gradient
  const darkenColor = (color, amount) => {
    if (color.startsWith("#") && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const darken = (c) => Math.max(0, c + amount);
      return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
    }
    const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      const darken = (c) => Math.max(0, c + amount);
      return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
    }
    return color;
  };

  const [direction, setDirection] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());
  const [imageScale, setImageScale] = useState(1);
  const [shareResult, setShareResult] = useState(null);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const modalRef = useRef(null);

  // Check if watermark should be shown
  const [showWatermark, setShowWatermark] = useState(() => {
    return safeGetFromStorage("showWatermark", true);
  });

  // Get custom watermark text
  const [watermarkText, setWatermarkText] = useState(() => {
    return safeGetFromStorage("watermarkText", "Created using CatShare");
  });

  // Get watermark position
  const [watermarkPosition, setWatermarkPosition] = useState(() => {
    return safeGetFromStorage("watermarkPosition", "bottom-left");
  });

  const effectiveWatermarkText = getEffectiveWatermarkText(isPro);
  const effectiveWatermarkPosition = getEffectiveWatermarkPosition(isPro);

  const handleDragEnd = (event, info) => {
    const offsetX = info.offset.x;
    const velocityY = info.velocity.y;

    if (offsetX < -40 && currentIndex < productList.length - 1) {
      setDirection(1);
      onSwipeLeft?.(productList[currentIndex + 1]);
    } else if (offsetX > 40 && currentIndex > 0) {
      setDirection(-1);
      onSwipeRight?.(productList[currentIndex - 1]);
    } else if (velocityY < -500) {
      // Fast upward flick
      onClose?.();
    }
  };

  useEffect(() => {
    const unsubscribe = onCurrencyChange((currency, symbol) => {
      setCurrencySymbol(symbol);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handler = () => {
      onClose();
    };
    window.addEventListener("close-preview", handler);
    return () => window.removeEventListener("close-preview", handler);
  }, [onClose]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // Listen for watermark setting changes
  useEffect(() => {
    const refreshWatermarkSettings = () => {
      setShowWatermark(safeGetFromStorage("showWatermark", true));
      setWatermarkText(safeGetFromStorage("watermarkText", "Created using CatShare"));
      setWatermarkPosition(safeGetFromStorage("watermarkPosition", "bottom-left"));
    };

    window.addEventListener("storage", refreshWatermarkSettings);
    window.addEventListener("watermarkChanged", refreshWatermarkSettings);
    window.addEventListener("watermarkTextChanged", refreshWatermarkSettings);
    window.addEventListener("watermarkPositionChanged", refreshWatermarkSettings);

    return () => {
      window.removeEventListener("storage", refreshWatermarkSettings);
      window.removeEventListener("watermarkChanged", refreshWatermarkSettings);
      window.removeEventListener("watermarkTextChanged", refreshWatermarkSettings);
      window.removeEventListener("watermarkPositionChanged", refreshWatermarkSettings);
    };
  }, []);

  useEffect(() => {
    const loadImage = async () => {
      setImageLoaded(false);
      const withVersion = (url, version) => {
        const raw = typeof url === "string" ? url.trim() : "";
        if (!raw) return "";
        if (!/^https?:\/\//i.test(raw)) return raw;
        const v = String(version ?? "").trim();
        if (!v) return raw;
        return `${raw}${raw.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
      };
      // Priority: cloud URL > local file > base64
      // 1. Try cloud URL first (Cloudflare R2)
      if (product?.imageUrl) {
        setImageUrl(withVersion(product.imageUrl, product.imageVersion));
        return;
      }

      // 2. Try local filesystem image
      if (product?.imagePath) {
        try {
          // Prefer External (visible user-* folder), fallback to Data for legacy.
          try {
            const result = await Filesystem.readFile({
              path: product.imagePath,
              directory: Directory.External,
            });
            setImageUrl(`data:image/png;base64,${result.data}`);
          } catch (externalErr) {
            const result = await Filesystem.readFile({
              path: product.imagePath,
              directory: Directory.Data,
            });
            setImageUrl(`data:image/png;base64,${result.data}`);
          }
        } catch (err) {
          console.warn("Failed to load image from filesystem:", err);
          setImageUrl(product.image || "");
        }
      } else {
        // 3. Fallback to base64 in-memory image
        setImageUrl(product.image || "");
      }
    };
    loadImage();
    setFieldDefinitionsUpdated(prev => prev + 1);
  }, [product]);

  const handleImageClick = (e) => {
    e.stopPropagation();
    // In glass theme, clicking image doesn't open fullscreen (can add later)
  };

  if (!product) return null;

  const bothOut = !product.wholesaleStock && !product.resellStock;
  const productList = filteredProducts.length > 0 ? filteredProducts : [product];
  const currentIndex = productList.findIndex((p) => p.id === product.id);

  const isWhiteBg =
    product.imageBgColor?.toLowerCase() === "white" ||
    product.imageBgColor?.toLowerCase() === "#ffffff";

  const cardBg = product.bgColor || currentTheme.styles.bgColor;
  const isLightCardBg =
    cardBg?.toLowerCase() === "white" ||
    cardBg?.toLowerCase() === "#ffffff" ||
    cardBg?.toLowerCase() === "#f8fafc" || // slate-50
    cardBg?.toLowerCase() === "#f1f5f9"; // slate-100

  const badgeBg = isWhiteBg ? "#fff" : "#666666";
  const badgeText = isWhiteBg ? "#000" : "#fff";
  const badgeBorder = isWhiteBg ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)";

  const getAllStockStatus = () => {
    const allCatalogues = getAllCatalogues();
    return allCatalogues.every((cat) => product[cat.stockField]);
  };

  const onToggleMasterStock = () => {
    const allCatalogues = getAllCatalogues();
    const allInStock = getAllStockStatus();
    const newStatus = !allInStock;

    const updatedProduct = { ...product };
    allCatalogues.forEach((cat) => {
      updatedProduct[cat.stockField] = newStatus;
    });

    if (onToggleStock) {
      onToggleStock(updatedProduct, true);
    }
  };

  const getCatalogueIdFromTab = () => {
    if (externalCatalogueId) return externalCatalogueId;
    if (tab === "catalogue1") return "cat1";
    if (tab === "catalogue2") return "cat2";
    if (tab && tab.startsWith("cat")) return tab;
    return "cat1";
  };

  const catalogueId = getCatalogueIdFromTab();
  const catalogueData = getCatalogueData(product, catalogueId);

  const catalogueConfig = getAllCatalogues().find(c => c.id === catalogueId);
  const priceField = catalogueConfig?.priceField || "price1";
  const priceUnitField = catalogueConfig?.priceUnitField || "price1Unit";

  // Check if product is out of stock in the current catalogue
  const stockField = catalogueConfig?.stockField || "wholesaleStock";
  const isCurrentCatalogueOutOfStock = !product[stockField];

  const priceValue = catalogueData[priceField] || product[priceField];
  const hasPriceValue = priceValue !== undefined && priceValue !== null && priceValue !== "" && priceValue !== 0;

  const hasFieldValue = (value) => value !== undefined && value !== null && value !== "";

  const [fieldDefinitionsUpdated, setFieldDefinitionsUpdated] = useState(0);

  useEffect(() => {
    const handleFieldDefinitionsChanged = () => {
      setFieldDefinitionsUpdated(prev => prev + 1);
    };
    window.addEventListener("fieldDefinitionsChanged", handleFieldDefinitionsChanged);
    return () => window.removeEventListener("fieldDefinitionsChanged", handleFieldDefinitionsChanged);
  }, []);

  useEffect(() => {
    const measureAndScale = () => {
      const card = document.querySelector('[data-card="product-preview-glass"]');
      if (!card) return;

      const cardHeight = card.offsetHeight;
      const availableHeight = window.innerHeight * 0.9;

      if (cardHeight > availableHeight) {
        const newScale = Math.max(0.4, (availableHeight - 20) / cardHeight);
        setImageScale(newScale);
      } else {
        setImageScale(1);
      }
    };

    const card = document.querySelector('[data-card="product-preview-glass"]');
    if (!card) return;

    const resizeObserver = new ResizeObserver(() => {
      measureAndScale();
    });

    resizeObserver.observe(card);

    const handleWindowResize = () => measureAndScale();
    window.addEventListener('resize', handleWindowResize);

    const timers = [
      setTimeout(() => measureAndScale(), 0),
      setTimeout(() => measureAndScale(), 50),
      setTimeout(() => measureAndScale(), 150),
    ];

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      timers.forEach(t => clearTimeout(t));
    };
  }, [product.id, product]);

  const enabledFields = getAllFields().filter(
    (f) => f.enabled && f.key.startsWith('field') && isFieldVisibleOnSurface(f, 'shareImage')
  );

  return (
    <>
      <div
        className="fixed inset-0 backdrop-blur-xl bg-black/75 flex items-center justify-center z-50 pointer-events-auto"
        onClick={onClose}
        role="presentation"
      >
        <div ref={modalRef}>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={product.id}
              drag="x"
              dragElastic={0.2}
              dragSnapToOrigin
              dragTransition={{ bounceStiffness: 200, bounceDamping: 20 }}
              onDragEnd={handleDragEnd}
              custom={direction}
              onClick={(e) => e.stopPropagation()}
              data-card="product-preview-glass"
              style={{
                display: "flex",
                flexDirection: "column",
                height: "auto",
                width: "85vw",
                maxWidth: "380px",
                borderRadius: `${currentTheme.rendering.cardBorderRadius}px`,
                overflow: "visible",
                scale: imageScale,
                transformOrigin: "center",
              }}
              initial={(dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 })}
              animate={{
                x: 0,
                opacity: 1,
                transition: { type: "spring", damping: 30, stiffness: 600, mass: 0.01 }
              }}
              exit={(dir) => ({
                x: dir < 0 ? 300 : -300,
                opacity: 0,
                transition: { type: "spring", damping: 30, stiffness: 600, mass: 0.01 }
              })}
            >
              {/* White Card Container */}
              <div
                style={{
                  position: "relative",
                  background: "white",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "16px",
                  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
                  overflow: "visible",
                }}
              >
                {/* Product Card Core - Image and Info */}
                <div style={{ position: "relative" }}>
                  {/* Image Section */}
                  <div
                    style={{
                      backgroundColor: product.imageBgColor || "white",
                      textAlign: "center",
                      padding: 0,
                      position: "relative",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      aspectRatio: product.cropAspectRatio || currentTheme.rendering.cropAspectRatio,
                      width: "100%",
                      overflow: "hidden",
                    }}
                    onClick={handleImageClick}
                  >
                    {!imageLoaded && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: product.imageBgColor || "white",
                          zIndex: 5,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            border: "3px solid rgba(0,0,0,0.1)",
                            borderTopColor: "rgba(0,0,0,0.4)",
                            animation: "spin 0.8s linear infinite",
                          }}
                        />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    )}
                    <img
                      src={imageUrl}
                      alt={product.name}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        margin: "0 auto",
                        opacity: imageLoaded ? 1 : 0,
                        transition: "opacity 0.2s ease",
                      }}
                    />

                    {(catalogueData.badge || product.badge) && (
                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          backgroundColor: isWhiteBg
                            ? "rgba(0, 0, 0, 0.35)"
                            : "rgba(255, 255, 255, 0.50)",
                          backdropFilter: "blur(20px) saturate(180%)",
                          WebkitBackdropFilter: "blur(20px) saturate(180%)",
                          color: isWhiteBg ? "rgba(255, 255, 255, 0.95)" : badgeText,
                          fontSize: 13,
                          fontWeight: "600",
                          padding: "8px 14px",
                          borderRadius: "999px",
                          boxShadow: isWhiteBg
                            ? "inset 0 2px 4px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.3)"
                            : "inset 0 2px 4px rgba(255, 255, 255, 0.7), 0 4px 16px rgba(0, 0, 0, 0.15)",
                          border: isWhiteBg
                            ? "1.5px solid rgba(255, 255, 255, 0.4)"
                            : "1.5px solid rgba(255, 255, 255, 0.8)",
                          letterSpacing: "0.5px",
                          pointerEvents: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {(catalogueData.badge || product.badge).toUpperCase()}
                      </div>
                    )}

                    {/* Watermark - Top and Center positions remain in image section */}
                    {showWatermark && !effectiveWatermarkPosition.startsWith('bottom') && (
                      <div
                        style={{
                          ...getGlassThemeWatermarkPosition(effectiveWatermarkPosition),
                          fontSize: "10px",
                          letterSpacing: "0.3px",
                          color: isWhiteBg ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.4)"
                        }}
                      >
                        {effectiveWatermarkText}
                      </div>
                    )}

                    {/* Out of Stock Bar */}
                    {(isCurrentCatalogueOutOfStock || bothOut) && (
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
                          zIndex: 10,
                          pointerEvents: "none"
                        }}
                      >
                        OUT OF STOCK
                      </div>
                    )}
                  </div>

                  {/* Red Gradient Background */}
                  <div
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${product.bgColor || currentTheme.styles.bgColor} 0%, ${darkenColor(product.bgColor || currentTheme.styles.bgColor, -40)} 50%, ${product.bgColor || currentTheme.styles.bgColor} 100%)`,
                      backgroundSize: "400% 400%",
                      width: "100%",
                      padding: "8px",
                      paddingTop: "0",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      position: "relative",
                      overflow: "visible",
                    }}
                  >
                    {/* Decorative gradient overlay - minimal for glass effect */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(0, 0, 0, 0.06) 0%, transparent 50%)",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    ></div>

                    {/* Glass Morphism Content Box */}
                    <div
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.28)",
                        backdropFilter: "blur(25px) saturate(180%)",
                        WebkitBackdropFilter: "blur(25px) saturate(180%)",
                        padding: "12px 12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        border: "2px solid rgba(255, 255, 255, 0.8)",
                        borderRadius: "14px",
                        width: "calc(100% - 16px)",
                        marginTop: "-30px",
                        marginLeft: "16px",
                        marginRight: "16px",
                        marginBottom: "16px",
                        boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.1)",
                        position: "relative",
                        zIndex: 2,
                      }}
                    >
                      {/* Product Name and Subtitle */}
                      <div style={{ textAlign: "center", marginBottom: 8 }}>
                        <p
                          style={{
                            fontWeight: "600",
                            fontSize: "18px",
                            margin: "0 0 4px 0",
                            color: product.fontColor || currentTheme.styles.fontColor || "#000000",
                          }}
                        >
                          {product.name}
                        </p>
                        {product.subtitle && (
                          <p style={{ fontStyle: "italic", fontSize: "13px", margin: 0, color: product.fontColor || currentTheme.styles.fontColor || "#000000" }}>
                            ({product.subtitle})
                          </p>
                        )}
                      </div>

                      {/* Fields - Aligned layout */}
                      <div style={{ flex: 1, marginBottom: 8, color: product.fontColor || currentTheme.styles.fontColor || "#000000", fontSize: "13px", width: "100%", paddingLeft: 20, paddingRight: 20 }}>
                        {enabledFields.map((field) => {
                          const fieldValue = catalogueData[field.key] !== undefined && catalogueData[field.key] !== null ? catalogueData[field.key] : (product[field.key] || "");
                          const hasValue = hasFieldValue(fieldValue);

                          const visibilityKey = `${field.key}Visible`;
                          const isVisible = catalogueData[visibilityKey] !== false && product[visibilityKey] !== false;

                          if (!hasValue || !isVisible) return null;

                          const unitKey = `${field.key}Unit`;
                          const unitValue = (catalogueData[unitKey] && catalogueData[unitKey] !== "") ? catalogueData[unitKey] : (product[unitKey] || "None");
                          const unitDisplay = (field.unitsEnabled && unitValue !== "None") ? unitValue : "";

                          return (
                            <div key={field.key} style={{ marginBottom: 4, display: "flex", alignItems: "flex-start" }}>
                              <span style={{ fontWeight: "500", width: "90px", flexShrink: 0 }}>{field.label}</span>
                              <span style={{ fontWeight: "500" }}>:</span>
                              <span style={{ textAlign: "left", marginLeft: "8px", flex: 1 }}>{fieldValue} {unitDisplay}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Price Badge */}
                      {hasPriceValue && (
                        <div
                          style={{
                          backgroundColor: product.bgColor || currentTheme.styles.bgColor,
                          color: product.fontColor || currentTheme.styles.fontColor || "white",
                          padding: "6px 16px",
                          textAlign: "center",
                          fontWeight: "600",
                          fontSize: "16px",
                          borderRadius: "10px",
                          marginTop: 8,
                          width: "calc(100% - 32px)",
                          whiteSpace: "nowrap",
                          border: "1px solid rgba(0, 0, 0, 0.1)",
                        }}
                        >
                          {currencySymbol}{catalogueData[priceField] || product[priceField]}{(() => {
                            const unit = (catalogueData[priceUnitField] && catalogueData[priceUnitField] !== "")
                              ? catalogueData[priceUnitField]
                              : (product[priceUnitField] || "/ piece");

                            return unit !== "None" ? ` ${unit}` : "";
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Watermark - Bottom positions moved to card bottom */}
                    {showWatermark && (effectiveWatermarkPosition || "").startsWith('bottom') && (
                      <div
                        style={{
                          ...getGlassThemeWatermarkPosition(effectiveWatermarkPosition),
                          fontSize: "10px",
                          letterSpacing: "0.3px",
                          color: isLightCardBg ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.45)",
                          zIndex: 30,
                          bottom: 8,
                        }}
                      >
                        {effectiveWatermarkText}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Exactly same like classic */}
                {tab === "products" && (
                  <div
                    className="px-4 py-3 border-t backdrop-blur-md"
                    style={{
                      flexShrink: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      borderColor: 'rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 active:bg-blue-600 transition-colors"
                      >
                        <FiEdit3 size={14} />
                        <span>Edit</span>
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onToggleMasterStock()}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs shadow-lg transition-all border ${
                          getAllStockStatus()
                            ? "bg-emerald-500 text-white border-transparent shadow-emerald-500/20"
                            : "bg-white text-gray-400 border-gray-200 shadow-none"
                        }`}
                        title="Toggle all catalogues"
                      >
                        {getAllStockStatus() ? <FiPackage size={14} /> : <FiX size={14} />}
                        <span>{getAllStockStatus() ? "In Stock" : "Out of Stock"}</span>
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowShelfModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 active:bg-rose-600 transition-colors"
                        title="Shelf Item"
                      >
                        <FiArchive size={14} />
                        <span>Shelf</span>
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Share Result Modal */}
      {shareResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full text-center">
            <div className="flex justify-center mb-4">
              {shareResult.status === "success" ? (
                <FiCheckCircle className="w-12 h-12 text-green-500" />
              ) : (
                <FiAlertCircle className="w-12 h-12 text-red-500" />
              )}
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {shareResult.status === "success" ? "Success!" : "Failed"}
            </h2>

            <p className="text-sm text-gray-600 mb-5">
              {shareResult.message}
            </p>

            <button
              onClick={() => setShareResult(null)}
              className="px-6 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Shelf Modal */}
      {showShelfModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setShowShelfModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Shelf this item now?</h2>
            <p className="text-sm text-gray-600 mb-5">
              It stays safe and can be restored or deleted later.
            </p>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  onShelf?.(product);
                  setShowShelfModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-800 transition"
              >
                Shelf
              </button>
              <button
                onClick={() => setShowShelfModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-full hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
