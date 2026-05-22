import React from 'react';
import { BannerSection } from '../../../types/homepage';

interface BannerSectionViewProps {
  section: BannerSection & { id: string };
  editMode?: boolean;
}

export default function BannerSectionView({ section }: BannerSectionViewProps) {
  const { settings, content } = section;
  const heightMap = { small: '150px', medium: '250px', large: '400px' };

  return (
    <div
      style={{
        height: heightMap[settings.height],
        background: settings.backgroundColor || '#2563eb',
        backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: settings.textAlignment as any,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${settings.overlayOpacity})` }}></div>
      <div style={{ position: 'relative', zIndex: 1, color: 'white', textAlign: settings.textAlignment as any, padding: '20px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.875rem', fontWeight: 600 }}>{content.title}</h2>
        {content.subtitle && <p style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{content.subtitle}</p>}
        {content.buttonText && (
          <button
            style={{
              padding: '8px 16px',
              background: '#white',
              color: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {content.buttonText}
          </button>
        )}
      </div>
    </div>
  );
}
