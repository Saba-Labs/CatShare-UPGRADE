import React from 'react';
import { CategoryShowcaseSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';

interface CategoryShowcaseSectionViewProps {
  section: CategoryShowcaseSection & { id: string };
  editMode?: boolean;
}

export default function CategoryShowcaseSectionView({ section, editMode }: CategoryShowcaseSectionViewProps) {
  const { settings, content } = section;

  return (
    <div style={{ background: settings.backgroundColor || 'transparent', padding: '20px', borderRadius: '8px' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: 600 }}>{settings.title}</h2>
      {content.categoryIds.length === 0 ? (
        <SectionPlaceholder
          title="Category Showcase"
          icon="📁"
          description={editMode ? 'Select categories in the properties panel' : 'No categories selected'}
          editMode={editMode}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, gap: '16px' }}>
          {Array(Math.min(content.categoryIds.length, settings.columns * 2))
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏷️</div>
                <p style={{ margin: '0 0 8px 0', fontWeight: 500, fontSize: '0.95rem' }}>Category {i + 1}</p>
                {settings.showCount && <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>0 items</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
