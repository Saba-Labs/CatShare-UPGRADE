import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productImageDisplayUrl } from "../utils/imageUrl";
import { getVideoPlaybackInfo } from "../utils/productGallery";
import "./ProductImageGallery.css";

type Props = {
  urls: string[];
  /** Hosted video URLs (YouTube, Vimeo, direct mp4, etc.) shown after images. */
  videoUrls?: string[];
  /** Which image slot is the designated primary (optional badge / initial slide). */
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

type GallerySlide =
  | { type: "image"; url: string; imageIndex: number }
  | { type: "video"; url: string; src: string; native: boolean };

function thumbSrc(
  url: string,
  index: number,
  primarySlot: number,
  primaryImageVersion?: number | string | null
) {
  const v = index === primarySlot && primaryImageVersion != null ? primaryImageVersion : null;
  return productImageDisplayUrl(url, v);
}

function buildSlides(imageUrls: string[], videoUrls: string[]): GallerySlide[] {
  const images: GallerySlide[] = imageUrls.map((url, imageIndex) => ({
    type: "image",
    url,
    imageIndex,
  }));
  const videos: GallerySlide[] = videoUrls.map((url) => {
    const { src, native } = getVideoPlaybackInfo(url);
    return { type: "video", url, src, native };
  });
  return [...images, ...videos];
}

/**
 * Simple swipe gallery for product images and videos (used in preview, store, and public views).
 */
export default function ProductImageGallery({
  urls,
  videoUrls = [],
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
  const safeVideoUrls = (videoUrls || []).map((u) => String(u || "").trim()).filter(Boolean);
  const slides = useMemo(
    () => buildSlides(safeUrls, safeVideoUrls),
    [safeUrls.join("\0"), safeVideoUrls.join("\0")]
  );
  const controlled =
    typeof controlledSlideIndex === "number" && typeof onSlideIndexChange === "function";
  const [internalIx, setInternalIx] = useState(0);

  useEffect(() => {
    if (controlled) return;
    const pi = Math.min(Math.max(0, primaryIndex ?? 0), Math.max(0, safeUrls.length - 1));
    setInternalIx(pi);
  }, [primaryIndex, safeUrls.length, controlled]);

  const n = slides.length;
  const safeIx =
    n === 0
      ? 0
      : Math.min(
          Math.max(0, controlled ? controlledSlideIndex! : internalIx),
          n - 1
        );
  const current = slides[safeIx];

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

  if (n === 0 || !current) return null;

  const primarySlot = Math.min(Math.max(0, primaryIndex ?? 0), Math.max(0, safeUrls.length - 1));
  const multi = n > 1;
  const withThumbs = showThumbnails && multi;

  const mainBgClass = fillContainer
    ? "bg-gray-100 dark:bg-gray-800"
    : "rounded-lg bg-gray-100 dark:bg-gray-800";
  const mainSizeClass =
    fillContainer && !withThumbs ? "h-full w-full" : fillContainer ? "w-full" : "aspect-square w-full";
  const imgFitClass = objectFit === "cover" ? "object-cover" : "object-contain";

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
    withThumbs ? "product-image-gallery--with-thumbs" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mainFrameClass = [
    "product-image-gallery__main",
    mainBgClass,
    !fillContainer ? "product-image-gallery__main--square" : mainSizeClass,
    current.type === "video" ? "product-image-gallery__main--video" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showPrimaryOnSlide =
    showPrimaryBadge &&
    current.type === "image" &&
    typeof primaryIndex === "number" &&
    current.imageIndex === primarySlot &&
    safeUrls.length > 1;

  return (
    <div className={rootClass}>
      <div
        className={mainFrameClass}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {current.type === "video" ? (
          current.native ? (
            <video
              key={current.src}
              src={current.src}
              controls
              controlsList="nodownload noplaybackrate noremoteplayback"
              disablePictureInPicture
              playsInline
              className={`product-image-gallery__native-video ${withThumbs ? "w-full" : "h-full w-full"} ${imgFitClass}`}
            />
          ) : (
            <iframe
              key={current.src}
              src={current.src}
              title="Product video"
              className="product-image-gallery__embed"
              allow="accelerometer; autoplay; encrypted-media; gyroscope"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
              allowFullScreen={false}
            />
          )
        ) : (
          <img
            key={thumbSrc(current.url, current.imageIndex, primarySlot, primaryImageVersion) || `idx-${safeIx}`}
            src={thumbSrc(current.url, current.imageIndex, primarySlot, primaryImageVersion)}
            alt=""
            className={`${withThumbs ? "w-full" : "h-full w-full"} ${imgFitClass}`}
            draggable={false}
          />
        )}
        {multi && (
          <>
            <button
              type="button"
              aria-label="Previous"
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
              aria-label="Next"
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
                {slides.map((slide, i) => (
                  <button
                    key={`dot-${i}-${slide.type === "video" ? slide.url : slide.url}`}
                    type="button"
                    aria-label={slide.type === "video" ? `Video ${i + 1}` : `Image ${i + 1}`}
                    className={`product-image-gallery__dot${i === safeIx ? " product-image-gallery__dot--active" : ""}${slide.type === "video" ? " product-image-gallery__dot--video" : ""}`}
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
        {showPrimaryOnSlide && (
          <span className="product-image-gallery__primary-badge">Primary</span>
        )}
      </div>
      {showThumbnails && multi && (
        <div className="product-image-gallery__thumbs">
          <div className="product-image-gallery__thumbs-track" role="tablist" aria-label="Product gallery">
            {slides.map((slide, i) => (
              <button
                key={`${slide.type}-${slide.url}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === safeIx}
                aria-label={slide.type === "video" ? `View video ${i + 1}` : `View image ${i + 1}`}
                className={`product-image-gallery__thumb${i === safeIx ? " product-image-gallery__thumb--active" : ""}${slide.type === "video" ? " product-image-gallery__thumb--video" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSlide(i);
                }}
              >
                {slide.type === "video" ? (
                  <span className="product-image-gallery__thumb-play" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                ) : (
                  <img
                    src={thumbSrc(slide.url, slide.imageIndex, primarySlot, primaryImageVersion)}
                    alt=""
                    draggable={false}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
