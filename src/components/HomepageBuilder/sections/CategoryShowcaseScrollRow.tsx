import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type ScrollNavigation = 'dots' | 'arrows' | 'both' | 'none';

interface CategoryShowcaseScrollRowProps {
  children: ReactNode;
  navigation?: ScrollNavigation;
}

export default function CategoryShowcaseScrollRow({
  children,
  navigation = 'both',
}: CategoryShowcaseScrollRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const showArrows = navigation === 'arrows' || navigation === 'both';
  const showDots = navigation === 'dots' || navigation === 'both';

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const overflow = maxScroll > 2;
    setShowNav(overflow);
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft < maxScroll - 2);

    if (!overflow) {
      setPageCount(1);
      setActivePage(0);
      return;
    }

    const pageWidth = Math.max(1, el.clientWidth);
    const pages = Math.max(1, Math.ceil(maxScroll / pageWidth) + 1);
    setPageCount(pages);
    setActivePage(Math.min(pages - 1, Math.round(el.scrollLeft / pageWidth)));
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, children]);

  const scrollByStep = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || '0') || 0;
    const step = firstCard ? firstCard.offsetWidth + gap : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const scrollToPage = (page: number) => {
    const el = trackRef.current;
    if (!el) return;
    const pageWidth = Math.max(1, el.clientWidth);
    el.scrollTo({ left: page * pageWidth, behavior: 'smooth' });
  };

  const showControls = showNav && navigation !== 'none';

  return (
    <div className="cat-showcase-scroll">
      <div className="cat-showcase__track cat-showcase-scroll__track" ref={trackRef}>
        {children}
      </div>
      {showControls && (showArrows || showDots) ? (
        <div className="cat-showcase-scroll__nav" role="group" aria-label="Category navigation">
          {showArrows ? (
            <button
              type="button"
              className="website-carousel-nav-btn"
              disabled={!canPrev}
              onClick={(e) => {
                e.stopPropagation();
                scrollByStep(-1);
              }}
              aria-label="Previous categories"
            >
              <span className="website-carousel-chevron website-carousel-chevron--left" aria-hidden />
            </button>
          ) : null}
          {showDots && pageCount > 1 ? (
            <div className="cat-showcase-scroll__dots" role="tablist" aria-label="Category pages">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`cat-showcase-scroll__dot${index === activePage ? ' is-active' : ''}`}
                  role="tab"
                  aria-selected={index === activePage}
                  aria-label={`Category page ${index + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToPage(index);
                  }}
                />
              ))}
            </div>
          ) : null}
          {showArrows ? (
            <button
              type="button"
              className="website-carousel-nav-btn"
              disabled={!canNext}
              onClick={(e) => {
                e.stopPropagation();
                scrollByStep(1);
              }}
              aria-label="Next categories"
            >
              <span className="website-carousel-chevron website-carousel-chevron--right" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
