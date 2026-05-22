import React from 'react';
import { ImageSection } from '../../../types/homepage';

interface ImageSectionViewProps {
  section: ImageSection & { id: string };
  editMode?: boolean;
}

export default function ImageSectionView({ section, editMode }: ImageSectionViewProps) {
  const { settings, content } = section;

  const widthMap = { small: '30%', medium: '50%', large: '80%', full: '100%' };
  const width = widthMap[settings.width];

  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  return (
    <div style={{ display: 'flex', justifyContent: alignMap[settings.alignment as any], width: '100%' }}>
      <div style={{ width }}>
        {content.url ? (
          <img
            src={content.url}
            alt={content.alt}
            style={{
              width: '100%',
              borderRadius: settings.rounded ? '8px' : '0',
              boxShadow: settings.shadow ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
            }}
          />
        ) : (
          <div
            style={{
              background: '#f3f4f6',
              aspectRatio: '1',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '3rem',
            }}
          >
            🖼️
          </div>
        )}
      </div>
    </div>
  );
}
