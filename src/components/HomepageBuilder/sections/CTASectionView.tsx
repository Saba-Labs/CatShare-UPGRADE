import React from 'react';
import { CTASection } from '../../../types/homepage';

interface CTASectionViewProps {
  section: CTASection & { id: string };
  editMode?: boolean;
}

export default function CTASectionView({ section }: CTASectionViewProps) {
  const { settings, content } = section;

  return (
    <div
      style={{
        background: settings.backgroundColor || '#f3f4f6',
        padding: '40px 20px',
        borderRadius: '8px',
        textAlign: settings.textAlignment as any,
      }}
    >
      <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: 600 }}>{content.title}</h2>
      {content.description && (
        <p style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#6b7280' }}>{content.description}</p>
      )}
      <button
        style={{
          padding: '10px 24px',
          background: settings.buttonColor || '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        {content.buttonText}
      </button>
    </div>
  );
}
