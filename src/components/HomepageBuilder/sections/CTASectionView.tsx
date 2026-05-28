import React from 'react';
import { CTASection, ThemeSettings } from '../../../types/homepage';
import { getThemeButtonStyles } from '../../../utils/themeButtonStyles';

interface CTASectionViewProps {
  section: CTASection & { id: string };
  theme?: ThemeSettings;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<CTASection>) => void;
}

export default function CTASectionView({ section, theme, editMode, onUpdateSection }: CTASectionViewProps) {
  const { settings, content } = section;

  const updateContent = (patch: Partial<CTASection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  return (
    <div
      style={{
        background: settings.backgroundColor || '#f8f9fa',
        padding: '40px 20px',
        textAlign: settings.textAlignment as React.CSSProperties['textAlign'],
      }}
    >
      {editMode && onUpdateSection ? (
        <>
          <h2
            className="sites-inline-editable sites-inline-heading"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateContent({ title: e.currentTarget.textContent || '' })}
          >
            {content.title}
          </h2>
          <p
            className="sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateContent({ description: e.currentTarget.textContent || '' })}
          >
            {content.description || 'Description'}
          </p>
          <span
            className="sites-inline-editable sites-inline-button"
            style={{
              ...getThemeButtonStyles(theme || {}, settings.buttonColor),
              display: 'inline-block',
              padding: '10px 24px',
              borderRadius: '4px',
              fontWeight: 600,
            }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateContent({ buttonText: e.currentTarget.textContent || '' })}
          >
            {content.buttonText}
          </span>
        </>
      ) : (
        <>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: 600 }}>{content.title}</h2>
          {content.description && (
            <p style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#5f6368' }}>{content.description}</p>
          )}
          <span
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.875rem',
              ...getThemeButtonStyles(theme || {}, settings.buttonColor),
            }}
          >
            {content.buttonText}
          </span>
        </>
      )}
    </div>
  );
}
