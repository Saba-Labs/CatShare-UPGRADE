import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface CategoryShowcaseMobileRowProps {
  children: ReactNode;
}

export default function CategoryShowcaseMobileRow({ children }: CategoryShowcaseMobileRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [showNav, setShowNav] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowNav(maxScroll > 2);
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      observer.disconnect();
    };
  }, [updateArrows, children]);

  const scroll = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || '0') || 0;
    const step = firstCard ? firstCard.offsetWidth + gap : el.clientWidth / 3;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className="cat-showcase-mobile-row">
      <div className="cat-showcase__track cat-showcase-mobile-row__track" ref={trackRef}>
        {children}
      </div>
      <div
        className={`cat-showcase-mobile-row__nav${showNav ? '' : ' cat-showcase-mobile-row__nav--hidden'}`}
        role="group"
        aria-label="Category navigation"
      >
        <button
          type="button"
          className="website-carousel-nav-btn"
          disabled={!canPrev}
          onClick={(e) => {
            e.stopPropagation();
            scroll(-1);
          }}
          aria-label="Previous categories"
        >
          <span className="website-carousel-chevron website-carousel-chevron--left" aria-hidden />
        </button>
        <button
          type="button"
          className="website-carousel-nav-btn"
          disabled={!canNext}
          onClick={(e) => {
            e.stopPropagation();
            scroll(1);
          }}
          aria-label="Next categories"
        >
          <span className="website-carousel-chevron website-carousel-chevron--right" aria-hidden />
        </button>
      </div>
    </div>
  );
}
