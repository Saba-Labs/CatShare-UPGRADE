import React from 'react';
import { TextSection } from '../../../types/homepage';

interface TextSectionViewProps {
  section: TextSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TextSection>) => void;
}

export default function TextSectionView({ section, editMode, onUpdateSection }: TextSectionViewProps) {
  const { settings, content } = section;

  const fontSizeMap = {
    small: '0.875rem',
    medium: '1rem',
    large: '1.5rem',
    xlarge: '2rem',
  };

  const styles: React.CSSProperties = {
    textAlign: settings.alignment as React.CSSProperties['textAlign'],
    fontSize: fontSizeMap[settings.fontSize],
    color: settings.textColor || 'inherit',
    backgroundColor: settings.backgroundColor || 'transparent',
    padding:
      settings.padding === 'small' ? '16px' : settings.padding === 'medium' ? '24px' : '32px',
  };

  if (editMode && onUpdateSection) {
    return (
      <div style={styles}>
        <div
          className="sites-inline-editable"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) =>
            onUpdateSection({
              content: { text: e.currentTarget.textContent || '' },
            })
          }
        >
          {content.text}
        </div>
      </div>
    );
  }

  return (
    <div style={styles}>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content.text}</p>
    </div>
  );
}
