import React from 'react';
import { TextSection } from '../../../types/homepage';
import './TextSection.css';

interface TextSectionViewProps {
  section: TextSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TextSection>) => void;
}

export default function TextSectionView({ section, editMode, onUpdateSection }: TextSectionViewProps) {
  const { settings, content } = section;

  return (
    <div
      className={`text-section text-section--size-${settings.fontSize} sites-section-pad--${settings.padding === 'small' ? 'small' : settings.padding === 'large' ? 'large' : 'medium'}`}
      style={{
        textAlign: settings.alignment as React.CSSProperties['textAlign'],
        color: settings.textColor || 'inherit',
        backgroundColor: settings.backgroundColor || 'transparent',
      }}
    >
      {editMode && onUpdateSection ? (
        <div
          className="text-section__body sites-inline-editable"
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
      ) : (
        <p className="text-section__body">{content.text}</p>
      )}
    </div>
  );
}
