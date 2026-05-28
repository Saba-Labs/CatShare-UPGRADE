import React from 'react';
import { CarouselSection } from '../../../types/homepage';

interface CarouselSectionViewProps {
  section: CarouselSection & { id: string };
  editMode?: boolean;
}

export default function CarouselSectionView({ section, editMode }: CarouselSectionViewProps) {
  const { content } = section;
  const firstImage = content.images[0];

  return (
    <div
      style={{
        background: '#f3f4f6',
        padding: '20px',
        borderRadius: '8px',
        textAlign: 'center',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {content.images.length === 0 ? (
        <div>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Carousel Section</p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {editMode ? 'Add images in the properties panel' : 'No images added'}
          </p>
        </div>
      ) : firstImage ? (
        <div style={{ width: '100%' }}>
          <div
            style={{
              width: '100%',
              maxHeight: 280,
              minHeight: 120,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #d1d5db',
              background: '#e5e7eb',
            }}
          >
            <img
              src={firstImage.url}
              alt={firstImage.title || 'Carousel image'}
              style={{
                width: '100%',
                height: '100%',
                maxHeight: 280,
                minHeight: 120,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
          <p style={{ margin: '10px 0 0 0', fontWeight: 500 }}>
            {content.images.length} image(s)
          </p>
          {editMode && content.images.length > 1 ? (
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              Showing first image in editor preview
            </p>
          ) : null}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#6b7280' }}>Could not preview image</p>
      )}
    </div>
  );
}
