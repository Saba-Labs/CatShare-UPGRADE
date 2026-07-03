import React, { useCallback, useEffect, useState } from 'react';
import { CarouselSection } from '../../../types/homepage';
import './CarouselSection.css';

interface CarouselSectionViewProps {
  section: CarouselSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
}

function getHeightClass(height: CarouselSection['settings']['height']) {
  if (height === 'small') return 'carousel-section--height-small';
  if (height === 'large') return 'carousel-section--height-large';
  return 'carousel-section--height-medium';
}

function getRatioClass(aspectRatio: CarouselSection['settings']['aspectRatio']) {
  if (aspectRatio === '4:3') return 'carousel-section--ratio-4-3';
  if (aspectRatio === 'square') return 'carousel-section--ratio-square';
  return 'carousel-section--ratio-16-9';
}

export default function CarouselSectionView({
  section,
  editMode = false,
  builderCanvas = false,
}: CarouselSectionViewProps) {
  const { settings, content } = section;
  const images = content.images;
  const [activeIndex, setActiveIndex] = useState(0);
  const pauseAutoPlay = editMode || builderCanvas;

  const goTo = useCallback(
    (index: number) => {
      if (images.length === 0) return;
      const next = ((index % images.length) + images.length) % images.length;
      setActiveIndex(next);
    },
    [images.length]
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, images.length]);

  useEffect(() => {
    if (!settings.autoPlay || pauseAutoPlay || images.length <= 1) return;
    const intervalMs = Math.max(1000, settings.interval || 5000);
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [settings.autoPlay, settings.interval, pauseAutoPlay, images.length]);

  const showArrows = settings.navigation === 'arrows' || settings.navigation === 'both';
  const showDots = settings.navigation === 'dots' || settings.navigation === 'both';
  const trackClass =
    settings.animation === 'slide' ? 'carousel-section__track--slide' : 'carousel-section__track--fade';

  if (images.length === 0) {
    return (
      <div
        className={`carousel-section carousel-section--empty ${getHeightClass(settings.height)} ${getRatioClass(settings.aspectRatio)}`}
      >
        <p className="carousel-section__title">Carousel Section</p>
        <p className="carousel-section__hint">
          {editMode ? 'Add images in the properties panel' : 'No images added'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`carousel-section ${getHeightClass(settings.height)} ${getRatioClass(settings.aspectRatio)}`}
      data-animation={settings.animation}
    >
      <div className="carousel-section__viewport">
        <div
          className={`carousel-section__track ${trackClass}`}
          style={
            settings.animation === 'slide'
              ? { transform: `translateX(-${activeIndex * 100}%)` }
              : undefined
          }
        >
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`carousel-section__slide${index === activeIndex ? ' is-active' : ''}`}
              aria-hidden={index !== activeIndex}
            >
              <div className="carousel-section__frame">
                <img src={image.url} alt={image.title || image.caption || `Slide ${index + 1}`} />
              </div>
            </div>
          ))}
        </div>

        {showArrows && images.length > 1 ? (
          <div className="carousel-section__arrows">
            <button type="button" className="carousel-section__arrow" onClick={goPrev} aria-label="Previous slide">
              ‹
            </button>
            <button type="button" className="carousel-section__arrow" onClick={goNext} aria-label="Next slide">
              ›
            </button>
          </div>
        ) : null}

        {showDots && images.length > 1 ? (
          <div className="carousel-section__dots" role="tablist" aria-label="Carousel slides">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                role="tab"
                className={`carousel-section__dot${index === activeIndex ? ' is-active' : ''}`}
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={index === activeIndex}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
