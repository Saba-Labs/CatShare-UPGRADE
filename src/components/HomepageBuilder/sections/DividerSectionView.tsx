import React from 'react';
import { DividerSection } from '../../../types/homepage';
import './DividerSection.css';

interface DividerSectionViewProps {
  section: DividerSection & { id: string };
}

export default function DividerSectionView({ section }: DividerSectionViewProps) {
  const { settings } = section;
  const spacingClass = `divider-section--spacing-${settings.spacing}`;
  const thicknessMap = { thin: 1, medium: 2, thick: 4 };
  const widthMap = { full: '100%', medium: '60%', narrow: '36%' };

  if (settings.style === 'space') {
    return <div className={`divider-section divider-section--space ${spacingClass}`} aria-hidden />;
  }

  return (
    <div className={`divider-section ${spacingClass}`}>
      {settings.style === 'dots' ? (
        <span className="divider-section--dots" style={{ color: settings.color || '#dadce0' }}>
          • • • • •
        </span>
      ) : (
        <hr
          style={{
            width: widthMap[settings.width],
            margin: 0,
            border: 'none',
            borderTop: `${thicknessMap[settings.thickness]}px solid ${settings.color || '#dadce0'}`,
          }}
        />
      )}
    </div>
  );
}
