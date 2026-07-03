import React from 'react';
import { CTASection, ThemeSettings } from '../../../types/homepage';
import { getThemeButtonStyles, SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import './CTASection.css';

interface CTASectionViewProps {
  section: CTASection & { id: string };
  theme?: ThemeSettings;
  editMode?: boolean;
  builderCanvas?: boolean;
  onUpdateSection?: (updates: Partial<CTASection>) => void;
}

export default function CTASectionView({ section, theme, editMode, builderCanvas = false, onUpdateSection }: CTASectionViewProps) {
  const { settings, content } = section;
  const buttonStyles = getThemeButtonStyles(theme || {}, settings.buttonColor);
  const align =
    settings.textAlignment ||
    (settings as { alignment?: 'left' | 'center' | 'right' }).alignment ||
    'center';
  const alignClass =
    align === 'left'
      ? 'cta-section--align-left'
      : align === 'right'
        ? 'cta-section--align-right'
        : 'cta-section--align-center';

  const updateContent = (patch: Partial<CTASection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  return (
    <div
      className={`cta-section sites-section-pad--cta ${alignClass}`}
      style={{
        background: settings.backgroundColor || '#f8f9fa',
      }}
    >
      {editMode && onUpdateSection ? (
        <>
          <h2
            className="cta-section__title sites-inline-editable sites-inline-heading"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateContent({ title: e.currentTarget.textContent || '' })}
          >
            {content.title}
          </h2>
          <p
            className="cta-section__description sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateContent({ description: e.currentTarget.textContent || '' })}
          >
            {content.description || 'Description'}
          </p>
          <span
            className={`sites-inline-editable ${SITES_THEME_BUTTON_CLASS}`}
            style={buttonStyles}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateContent({ buttonText: e.currentTarget.textContent || '' })}
          >
            {content.buttonText}
          </span>
        </>
      ) : (
        <>
          <h2 className="cta-section__title">{content.title}</h2>
          {content.description && <p className="cta-section__description">{content.description}</p>}
          {content.buttonText &&
            (content.buttonLink ? (
              <StorefrontLink href={content.buttonLink} preview={builderCanvas} className={SITES_THEME_BUTTON_CLASS} style={buttonStyles}>
                {content.buttonText}
              </StorefrontLink>
            ) : (
              <span className={SITES_THEME_BUTTON_CLASS} style={buttonStyles}>
                {content.buttonText}
              </span>
            ))}
        </>
      )}
    </div>
  );
}
