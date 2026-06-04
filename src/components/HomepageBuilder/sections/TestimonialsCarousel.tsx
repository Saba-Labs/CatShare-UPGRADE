import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface TestimonialsCarouselProps {
  children: ReactNode;
}

export default function TestimonialsCarousel({ children }: TestimonialsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
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
    const gap = 6;
    const step = firstCard ? firstCard.offsetWidth + gap : Math.max(280, el.clientWidth * 0.5);
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className="testimonials-carousel">
      <div className="testimonials-carousel-track" ref={trackRef}>
        {children}
      </div>
      <div className="website-carousel-nav-row" role="group" aria-label="Testimonials navigation">
        <button
          type="button"
          className="website-carousel-nav-btn"
          disabled={!canPrev}
          onClick={(e) => {
            e.stopPropagation();
            scroll(-1);
          }}
          aria-label="Previous testimonials"
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
          aria-label="Next testimonials"
        >
          <span className="website-carousel-chevron website-carousel-chevron--right" aria-hidden />
        </button>
      </div>
    </div>
  );
}
