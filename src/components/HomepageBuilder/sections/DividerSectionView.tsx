import React from 'react';
import { DividerSection } from '../../../types/homepage';

interface DividerSectionViewProps {
  section: DividerSection & { id: string };
}

export default function DividerSectionView({ section }: DividerSectionViewProps) {
  const { settings } = section;
  const spacingMap = { small: '0.75rem', medium: '1.5rem', large: '2.5rem' };
  const thicknessMap = { thin: 1, medium: 2, thick: 4 };
  const widthMap = { full: '100%', medium: '60%', narrow: '36%' };

  if (settings.style === 'space') {
    return <div style={{ height: spacingMap[settings.spacing], width: '100%' }} aria-hidden />;
  }

  const paddingY = spacingMap[settings.spacing];

  return (
    <div style={{ padding: `${paddingY} 0`, display: 'flex', justifyContent: 'center' }}>
      {settings.style === 'dots' ? (
        <span style={{ color: settings.color || '#dadce0', letterSpacing: '0.35em', fontSize: '0.65rem' }}>
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
