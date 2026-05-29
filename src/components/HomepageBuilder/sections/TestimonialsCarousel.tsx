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
    const gap = 20;
    const step = firstCard ? firstCard.offsetWidth + gap : Math.max(280, el.clientWidth * 0.9);
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className="testimonials-carousel">
      <button
        type="button"
        className="testimonials-carousel-arrow testimonials-carousel-arrow--prev"
        disabled={!canPrev}
        onClick={(e) => {
          e.stopPropagation();
          scroll(-1);
        }}
        aria-label="Previous testimonials"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="testimonials-carousel-track" ref={trackRef}>
        {children}
      </div>
      <button
        type="button"
        className="testimonials-carousel-arrow testimonials-carousel-arrow--next"
        disabled={!canNext}
        onClick={(e) => {
          e.stopPropagation();
          scroll(1);
        }}
        aria-label="Next testimonials"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
