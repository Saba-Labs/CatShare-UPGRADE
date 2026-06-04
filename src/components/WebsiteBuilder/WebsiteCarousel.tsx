import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react';

export type WebsiteCarouselProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  /** Sets --carousel-item-width for desktop column sizing (mobile always shows 2 items). */
  style?: CSSProperties;
  prevLabel?: string;
  nextLabel?: string;
};

export default function WebsiteCarousel({
  children,
  className = '',
  trackClassName = '',
  style,
  prevLabel = 'Previous',
  nextLabel = 'Next',
}: WebsiteCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: -1 | 1) => {
    const node = trackRef.current;
    if (!node) return;
    const first = node.firstElementChild as HTMLElement | null;
    const gap = 12;
    const step = first ? first.offsetWidth + gap : node.clientWidth * 0.5;
    node.scrollBy({ left: step * direction, behavior: 'smooth' });
  }, []);

  return (
    <div className={`website-carousel-block ${className}`.trim()} style={style}>
      <div
        ref={trackRef}
        className={`website-carousel-track ${trackClassName}`.trim()}
      >
        {children}
      </div>
      <div className="website-carousel-nav-row" role="group" aria-label="Carousel navigation">
        <button
          type="button"
          className="website-carousel-nav-btn"
          aria-label={prevLabel}
          onClick={() => scroll(-1)}
        >
          <span className="website-carousel-chevron website-carousel-chevron--left" aria-hidden />
        </button>
        <button
          type="button"
          className="website-carousel-nav-btn"
          aria-label={nextLabel}
          onClick={() => scroll(1)}
        >
          <span className="website-carousel-chevron website-carousel-chevron--right" aria-hidden />
        </button>
      </div>
    </div>
  );
}
