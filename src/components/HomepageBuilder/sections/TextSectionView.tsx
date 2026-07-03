import React, { useCallback, useEffect, useRef } from 'react';
import { TextSection } from '../../../types/homepage';
import './TextSection.css';

interface TextSectionViewProps {
  section: TextSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TextSection>) => void;
}

export default function TextSectionView({ section, editMode, onUpdateSection }: TextSectionViewProps) {
  const { settings, content } = section;
  const editableRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);

  const syncDomFromProp = useCallback(() => {
    const el = editableRef.current;
    if (!el || isFocusedRef.current) return;
    const next = content.text || '';
    if (el.textContent !== next) {
      el.textContent = next;
    }
  }, [content.text]);

  useEffect(() => {
    syncDomFromProp();
  }, [syncDomFromProp, editMode]);

  const commitText = (text: string) => {
    if (text === content.text) return;
    onUpdateSection?.({ content: { text } });
  };

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
          ref={editableRef}
          className="text-section__body sites-inline-editable"
          style={{ textAlign: settings.alignment as React.CSSProperties['textAlign'] }}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={(e) => {
            isFocusedRef.current = false;
            commitText(e.currentTarget.textContent || '');
          }}
          onInput={(e) => {
            commitText(e.currentTarget.textContent || '');
          }}
        />
      ) : (
        <p className="text-section__body">{content.text}</p>
      )}
    </div>
  );
}
