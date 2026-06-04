import React, { useCallback, useEffect, useRef, useState } from "react";
import { productImageDisplayUrl } from "../utils/imageUrl";
import "./ProductImageGallery.css";

type Props = {
  urls: string[];
  /** Which slot is the designated primary (optional badge / initial slide). */
  primaryIndex?: number;
  className?: string;
  /** Optional per-URL version (e.g. product.imageVersion for primary only). */
  primaryImageVersion?: number | string | null;
  /** Controlled slide (e.g. product preview fullscreen must match visible slide). Requires onSlideIndexChange. */
  slideIndex?: number;
  onSlideIndexChange?: (index: number) => void;
  /** Fill parent box (store cards / drawer) instead of forcing aspect-square. */
  fillContainer?: boolean;
  objectFit?: "contain" | "cover";
  showPrimaryBadge?: boolean;
  enableTouchSwipe?: boolean;
  /** Thumbnail strip below main preview (store product page). */
  showThumbnails?: boolean;
};

function thumbSrc(
  url: string,
  index: number,
  primarySlot: number,
  primaryImageVersion?: number | string | null
) {
  const v = index === primarySlot && primaryImageVersion != null ? primaryImageVersion : null;
  return productImageDisplayUrl(url, v);
}

/**
 * Simple swipe gallery for product images (used in preview, store, and public views).
 */
export default function ProductImageGallery({
  urls,
  primaryIndex = 0,
  className = "",
  primaryImageVersion,
  slideIndex: controlledSlideIndex,
  onSlideIndexChange,
  fillContainer = false,
  objectFit = "contain",
  showPrimaryBadge = true,
  enableTouchSwipe = true,
  showThumbnails = false,
}: Props) {
  const touchStartX = useRef<number | null>(null);
  const safeUrls = (urls || []).map((u) => String(u || "").trim()).filter(Boolean);
  const controlled =
    typeof controlledSlideIndex === "number" && typeof onSlideIndexChange === "function";
  const [internalIx, setInternalIx] = useState(0);

  useEffect(() => {
    if (controlled) return;
    const pi = Math.min(Math.max(0, primaryIndex ?? 0), Math.max(0, safeUrls.length - 1));
    setInternalIx(pi);
  }, [primaryIndex, JSON.stringify(safeUrls), controlled]);

  const n = safeUrls.length;
  const safeIx =
    n === 0
      ? 0
      : Math.min(
          Math.max(0, controlled ? controlledSlideIndex! : internalIx),
          n - 1
        );
  const current = safeUrls[safeIx] || "";

  const setSlide = useCallback(
    (next: number) => {
      if (n <= 1) return;
      const wrapped = (next % n + n) % n;
      if (controlled) onSlideIndexChange!(wrapped);
      else setInternalIx(wrapped);
    },
    [n, controlled, onSlideIndexChange]
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      if (n <= 1) return;
      setSlide(safeIx + dir);
    },
    [n, safeIx, setSlide]
  );

  if (n === 0) return null;

  const primarySlot = Math.min(Math.max(0, primaryIndex ?? 0), Math.max(0, n - 1));
  const src = thumbSrc(current, safeIx, primarySlot, primaryImageVersion);

  const mainBgClass = fillContainer
    ? "bg-gray-100 dark:bg-gray-800"
    : "rounded-lg bg-gray-100 dark:bg-gray-800";
  const mainSizeClass = fillContainer ? "h-full w-full" : "aspect-square w-full";
  const imgFitClass = objectFit === "cover" ? "object-cover" : "object-contain";
  const multi = n > 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableTouchSwipe || !multi) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!enableTouchSwipe || !multi || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    go(dx > 0 ? -1 : 1);
  };

  const rootClass = [
    "product-image-gallery",
    fillContainer ? "product-image-gallery--fill" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mainFrameClass = [
    "product-image-gallery__main",
    mainBgClass,
    !fillContainer ? "product-image-gallery__main--square" : mainSizeClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <div
        className={mainFrameClass}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={src || `idx-${safeIx}`}
          src={src}
          alt=""
          className={`h-full w-full ${imgFitClass}`}
          draggable={false}
        />
        {multi && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              className="product-image-gallery__nav product-image-gallery__nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              className="product-image-gallery__nav product-image-gallery__nav--next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
            >
              ›
            </button>
            {!showThumbnails && (
              <div className="product-image-gallery__dots">
                {safeUrls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Image ${i + 1}`}
                    className={`product-image-gallery__dot${i === safeIx ? " product-image-gallery__dot--active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlide(i);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {showPrimaryBadge &&
          typeof primaryIndex === "number" &&
          primaryIndex === safeIx &&
          multi && (
            <span className="product-image-gallery__primary-badge">Primary</span>
          )}
      </div>
      {showThumbnails && multi && (
        <div className="product-image-gallery__thumbs">
          <div className="product-image-gallery__thumbs-track" role="tablist" aria-label="Product images">
            {safeUrls.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === safeIx}
                aria-label={`View image ${i + 1}`}
                className={`product-image-gallery__thumb${i === safeIx ? " product-image-gallery__thumb--active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSlide(i);
                }}
              >
                <img src={thumbSrc(url, i, primarySlot, primaryImageVersion)} alt="" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
