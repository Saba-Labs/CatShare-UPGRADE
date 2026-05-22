import React from 'react';
import { FeaturedProductsSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';

interface FeaturedProductsSectionViewProps {
  section: FeaturedProductsSection & { id: string };
  editMode?: boolean;
}

export default function FeaturedProductsSectionView({ section, editMode }: FeaturedProductsSectionViewProps) {
  const { settings, content } = section;

  return (
    <div style={{ background: settings.backgroundColor || 'transparent', padding: '20px', borderRadius: '8px' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: 600 }}>{settings.title}</h2>
      {content.productIds.length === 0 ? (
        <SectionPlaceholder
          title="Featured Products"
          icon="🛍️"
          description={editMode ? 'Select products in the properties panel' : 'No products selected'}
          editMode={editMode}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, gap: '16px' }}>
          {Array(Math.min(settings.itemsPerPage, content.productIds.length))
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📦</div>
                <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Product {i + 1}</p>
                {settings.showPrice && <p style={{ margin: 0, color: '#2563eb', fontWeight: 600 }}>$0.00</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
