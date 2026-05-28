import React from 'react';
import { BannerSection, ThemeSettings } from '../../../types/homepage';
import { getThemeButtonStyles } from '../../../utils/themeButtonStyles';

interface BannerSectionViewProps {
  section: BannerSection & { id: string };
  theme?: ThemeSettings;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<BannerSection>) => void;
}

export default function BannerSectionView({ section, theme, editMode, onUpdateSection }: BannerSectionViewProps) {
  const { settings, content } = section;
  const heightMap = { small: '150px', medium: '250px', large: '400px' };

  const updateContent = (patch: Partial<BannerSection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  return (
    <div
      style={{
        height: heightMap[settings.height],
        background: settings.backgroundColor || '#1a73e8',
        backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: settings.textAlignment as React.CSSProperties['justifyContent'],
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${settings.overlayOpacity})` }} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          color: 'white',
          textAlign: settings.textAlignment as React.CSSProperties['textAlign'],
          padding: '20px',
          width: '100%',
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
              onBlur={(e) => updateContent({ subtitle: e.currentTarget.textContent || '' })}
            >
              {content.subtitle || 'Subtitle'}
            </p>
            <span
              className="sites-inline-editable sites-inline-button"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateContent({ buttonText: e.currentTarget.textContent || '' })}
            >
              {content.buttonText || 'Button'}
            </span>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.875rem', fontWeight: 600 }}>{content.title}</h2>
            {content.subtitle && <p style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{content.subtitle}</p>}
            {content.buttonText && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontWeight: 500,
                  ...getThemeButtonStyles(theme || {}, '#fff'),
                }}
              >
                {content.buttonText}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
