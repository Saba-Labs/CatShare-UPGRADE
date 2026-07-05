import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface TestimonialsCarouselProps {
  children: ReactNode;
}

function getTrackCards(track: HTMLDivElement): HTMLElement[] {
  return Array.from(track.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
}

function getActiveCardIndex(track: HTMLDivElement, cards: HTMLElement[]): number {
  if (cards.length === 0) return 0;
  const viewportCenter = track.scrollLeft + track.clientWidth / 2;
  let activeIndex = 0;
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    if (cardCenter <= viewportCenter + 1) {
      activeIndex = index;
    }
  }
  return activeIndex;
}

export default function TestimonialsCarousel({ children }: TestimonialsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = getTrackCards(track);
    if (cards.length <= 1) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    if (maxScroll <= 1) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }

    const activeIndex = getActiveCardIndex(track, cards);
    setCanPrev(activeIndex > 0 || track.scrollLeft > 2);
    setCanNext(activeIndex < cards.length - 1 || track.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    updateArrows();
    const track = trackRef.current;
    if (!track) return;

    track.addEventListener('scroll', updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    for (const card of getTrackCards(track)) {
      observer.observe(card);
    }

    return () => {
      track.removeEventListener('scroll', updateArrows);
      observer.disconnect();
    };
  }, [updateArrows, children]);

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = getTrackCards(track);
    if (cards.length === 0) return;

    const activeIndex = getActiveCardIndex(track, cards);
    const targetIndex = Math.max(0, Math.min(cards.length - 1, activeIndex + direction));
    if (targetIndex === activeIndex) return;

    const targetCard = cards[targetIndex];
    track.scrollTo({ left: targetCard.offsetLeft, behavior: 'smooth' });
    window.setTimeout(updateArrows, 350);
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
