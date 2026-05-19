import React, { useCallback, useEffect, useRef, useState } from "react";
import { productImageDisplayUrl } from "../utils/imageUrl";

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
};

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
  const src =
    safeIx === primarySlot && primaryImageVersion != null
      ? productImageDisplayUrl(current, primaryImageVersion)
      : productImageDisplayUrl(current, null);

  const frameClass = fillContainer
    ? "relative h-full w-full overflow-hidden bg-gray-100 dark:bg-gray-800"
    : "relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800";
  const imgFitClass = objectFit === "cover" ? "object-cover" : "object-contain";

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableTouchSwipe || n <= 1) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!enableTouchSwipe || n <= 1 || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    go(dx > 0 ? -1 : 1);
  };

  return (
    <div className={`relative w-full ${fillContainer ? "h-full" : ""} ${className}`.trim()}>
      <div
        className={frameClass}
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
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-sm text-white"
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
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-2 py-1 text-sm text-white"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
            >
              ›
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {safeUrls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  className={`h-1.5 rounded-full ${i === safeIx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlide(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
        {showPrimaryBadge &&
          typeof primaryIndex === "number" &&
          primaryIndex === safeIx &&
          n > 1 && (
            <span className="absolute left-2 top-2 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              Primary
            </span>
          )}
      </div>
    </div>
  );
}
