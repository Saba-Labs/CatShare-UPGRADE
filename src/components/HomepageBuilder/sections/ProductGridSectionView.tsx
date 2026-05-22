import React from 'react';
import { ProductGridSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';

interface ProductGridSectionViewProps {
  section: ProductGridSection & { id: string };
  editMode?: boolean;
}

export default function ProductGridSectionView({ section, editMode }: ProductGridSectionViewProps) {
  const { settings, content } = section;

  return (
    <div style={{ background: settings.backgroundColor || 'transparent', padding: '20px', borderRadius: '8px' }}>
      {settings.showSearch && (
        <input
          type="text"
          placeholder="Search products..."
          style={{
            width: '100%',
            padding: '8px 12px',
            marginBottom: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
          }}
          disabled
        />
      )}

      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: 600 }}>{settings.title}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, gap: '16px' }}>
        {Array(Math.min(settings.itemsToShow, 12))
          .fill(null)
          .map((_, i) => (
            <div
              key={i}
              style={{
                background: '#f9fafb',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📦</div>
              <p style={{ margin: '0 0 6px 0', fontWeight: 500, fontSize: '0.875rem' }}>Product {i + 1}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
