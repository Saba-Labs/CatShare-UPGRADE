import React from 'react';
import { CarouselSection } from '../../../types/homepage';
import './CarouselSection.css';

interface CarouselSectionViewProps {
  section: CarouselSection & { id: string };
  editMode?: boolean;
}

export default function CarouselSectionView({ section, editMode }: CarouselSectionViewProps) {
  const { content } = section;
  const firstImage = content.images[0];

  return (
    <div className="carousel-section">
      {content.images.length === 0 ? (
        <div>
          <p className="carousel-section__title">Carousel Section</p>
          <p className="carousel-section__hint">
            {editMode ? 'Add images in the properties panel' : 'No images added'}
          </p>
        </div>
      ) : firstImage ? (
        <div className="carousel-section__inner">
          <div className="carousel-section__media">
            <img src={firstImage.url} alt={firstImage.title || 'Carousel image'} />
          </div>
          <p className="carousel-section__count">{content.images.length} image(s)</p>
          {editMode && content.images.length > 1 ? (
            <p className="carousel-section__editor-note">Showing first image in editor preview</p>
          ) : null}
        </div>
      ) : (
        <p className="carousel-section__hint">Could not preview image</p>
      )}
    </div>
  );
}
