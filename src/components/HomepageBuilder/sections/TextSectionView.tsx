import React from 'react';
import { TextSection } from '../../../types/homepage';

interface TextSectionViewProps {
  section: TextSection & { id: string };
  editMode?: boolean;
}

export default function TextSectionView({ section, editMode }: TextSectionViewProps) {
  const { settings, content } = section;

  const fontSizeMap = {
    small: '0.875rem',
    medium: '1rem',
    large: '1.5rem',
    xlarge: '2rem',
  };

  const styles: React.CSSProperties = {
    textAlign: settings.alignment as any,
    fontSize: fontSizeMap[settings.fontSize],
    color: settings.textColor || 'inherit',
    backgroundColor: settings.backgroundColor || 'transparent',
    padding:
      settings.padding === 'small'
        ? '16px'
        : settings.padding === 'medium'
          ? '24px'
          : '32px',
  };

  return (
    <div style={styles}>
      {editMode ? (
        <textarea
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '8px',
            border: '1px dashed #ddd',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
          defaultValue={content.text}
          disabled
          placeholder="Text content here..."
        />
      ) : (
        <p style={{ margin: 0 }}>{content.text}</p>
      )}
    </div>
  );
}
