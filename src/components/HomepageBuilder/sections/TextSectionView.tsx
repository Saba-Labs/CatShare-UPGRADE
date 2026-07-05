import React from 'react';
import { TextSection } from '../../../types/homepage';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
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
        <BuilderInlineEditable
          tag="div"
          className="text-section__body"
          style={{ textAlign: settings.alignment as React.CSSProperties['textAlign'] }}
          value={content.text || ''}
          onChange={(text) => onUpdateSection({ content: { text } })}
          role="textbox"
          aria-multiline="true"
        />
      ) : (
        <BuilderHtmlContent html={content.text} className="text-section__body" tag="div" />
      )}
    </div>
  );
}
