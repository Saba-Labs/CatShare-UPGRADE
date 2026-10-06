import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CarouselSection } from '../../../types/homepage';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import './CarouselSection.css';

interface CarouselSectionViewProps {
  section: CarouselSection & { id: string };
  blockHeightPx?: number;
  editMode?: boolean;
  builderCanvas?: boolean;
  onUpdateSection?: (updates: Partial<CarouselSection>) => void;
}

type ImagePanPreview = { id: string; x: number; y: number };
type ImagePanDrag = {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  zoom: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  blockHeightPx,
  editMode = false,
  builderCanvas = false,
  onUpdateSection,
}: CarouselSectionViewProps) {
  const { settings, content } = section;
  const images = content.images;
  const [activeIndex, setActiveIndex] = useState(0);
  const [imagePanPreview, setImagePanPreview] = useState<ImagePanPreview | null>(null);
  const imagePanDragRef = useRef<ImagePanDrag | null>(null);
  const pauseAutoPlay = editMode || builderCanvas;
  const canDragImages = editMode && builderCanvas && !!onUpdateSection;

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

  const handleImagePointerDown = (image: CarouselSection['content']['images'][number], event: React.PointerEvent<HTMLImageElement>) => {
    if (!canDragImages || event.button !== 0) return;
    const frame = event.currentTarget.parentElement;
    if (!frame) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const drag: ImagePanDrag = {
      id: image.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: image.imageView?.x ?? 50,
      startY: image.imageView?.y ?? 50,
      x: image.imageView?.x ?? 50,
      y: image.imageView?.y ?? 50,
      zoom: image.imageView?.zoom ?? 1,
    };
    imagePanDragRef.current = drag;
    setImagePanPreview({ id: image.id, x: drag.x, y: drag.y });
  };

  const handleImagePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const drag = imagePanDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const frame = event.currentTarget.parentElement;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    drag.x = clamp(drag.startX + ((event.clientX - drag.startClientX) / bounds.width) * 100, 0, 100);
    drag.y = clamp(drag.startY + ((event.clientY - drag.startClientY) / bounds.height) * 100, 0, 100);
    setImagePanPreview({ id: drag.id, x: drag.x, y: drag.y });
  };

  const finishImagePan = (event: React.PointerEvent<HTMLImageElement>, commit: boolean) => {
    const drag = imagePanDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (commit && (drag.x !== drag.startX || drag.y !== drag.startY)) {
      onUpdateSection?.({
        content: {
          ...content,
          images: images.map((image) =>
            image.id === drag.id
              ? { ...image, imageView: { zoom: drag.zoom, x: drag.x, y: drag.y } }
              : image
          ),
        },
      });
    }
    imagePanDragRef.current = null;
    setImagePanPreview(null);
  };

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
      style={blockHeightPx ? { height: '100%' } : undefined}
    >
      <div
        className="carousel-section__viewport"
        style={blockHeightPx ? { height: '100%', maxHeight: 'none', aspectRatio: 'auto' } : undefined}
      >
        <div
          className={`carousel-section__track ${trackClass}`}
          style={
            settings.animation === 'slide'
              ? { transform: `translateX(-${activeIndex * 100}%)` }
              : undefined
          }
        >
          {images.map((image, index) => {
            const zoom = image.imageView?.zoom ?? 1;
            const canDragImage = canDragImages && zoom > 1;
            const panX = imagePanPreview?.id === image.id ? imagePanPreview.x : image.imageView?.x ?? 50;
            const panY = imagePanPreview?.id === image.id ? imagePanPreview.y : image.imageView?.y ?? 50;
            const translateX = ((panX - 50) / 50) * ((zoom - 1) * 50);
            const translateY = ((panY - 50) / 50) * ((zoom - 1) * 50);
            const frame = (
              <div
                className={`carousel-section__frame${canDragImage ? ' carousel-section__frame--editable' : ''}${imagePanPreview?.id === image.id ? ' carousel-section__frame--dragging' : ''}`}
              >
                <img
                  src={image.url}
                  alt={image.title || image.caption || `Slide ${index + 1}`}
                  draggable={false}
                  style={{ transform: `translate(${translateX}%, ${translateY}%) scale(${zoom})`, transformOrigin: 'center' }}
                  onPointerDown={canDragImage ? (event) => handleImagePointerDown(image, event) : undefined}
                  onPointerMove={canDragImage ? handleImagePointerMove : undefined}
                  onPointerUp={canDragImage ? (event) => finishImagePan(event, true) : undefined}
                  onPointerCancel={canDragImage ? (event) => finishImagePan(event, false) : undefined}
                />
              </div>
            );

            return (
              <div
                key={image.id}
                className={`carousel-section__slide${index === activeIndex ? ' is-active' : ''}`}
                aria-hidden={index !== activeIndex}
              >
                {image.link ? (
                  <StorefrontLink href={image.link} className="carousel-section__link" preview={editMode || builderCanvas}>
                    {frame}
                  </StorefrontLink>
                ) : (
                  frame
                )}
              </div>
            );
          })}
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
