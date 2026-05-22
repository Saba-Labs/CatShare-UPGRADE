import React from 'react';
import { CarouselSection } from '../../../types/homepage';

interface CarouselSectionViewProps {
  section: CarouselSection & { id: string };
  editMode?: boolean;
}

export default function CarouselSectionView({ section, editMode }: CarouselSectionViewProps) {
  const { content } = section;

  return (
    <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', textAlign: 'center', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {content.images.length === 0 ? (
        <div>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Carousel Section</p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {editMode ? 'Add images in the properties panel' : 'No images added'}
          </p>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🖼️</div>
          <p style={{ margin: 0, fontWeight: 500 }}>{content.images.length} image(s)</p>
        </div>
      )}
    </div>
  );
}
