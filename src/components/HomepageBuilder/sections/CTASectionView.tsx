import React from 'react';
import { CTASection, ThemeSettings } from '../../../types/homepage';
import { getBuilderButtonStyles } from '../../../utils/buttonStyleUtils';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
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
  const buttonStyles = getBuilderButtonStyles(settings, theme || {});
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
  const canEdit = Boolean(editMode && onUpdateSection);

  const updateContent = (patch: Partial<CTASection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  const renderButtonLabel = () => {
    if (canEdit) {
      return (
        <BuilderInlineEditable
          tag="span"
          value={content.buttonText || ''}
          placeholder="Button"
          onChange={(buttonText) => updateContent({ buttonText })}
        />
      );
    }
    return <BuilderHtmlContent html={content.buttonText} tag="span" />;
  };

  return (
    <div
      className={`cta-section sites-section-pad--cta ${alignClass}`}
      style={{
        background: settings.backgroundColor || '#f8f9fa',
      }}
    >
      <h2 className="cta-section__title">
        {canEdit ? (
          <BuilderInlineEditable
            tag="span"
            value={content.title}
            placeholder="Title"
            onChange={(title) => updateContent({ title })}
          />
        ) : (
          <BuilderHtmlContent html={content.title} tag="span" />
        )}
      </h2>
      {(canEdit || content.description) && (
        <p className="cta-section__description">
          {canEdit ? (
            <BuilderInlineEditable
              tag="span"
              value={content.description || ''}
              placeholder="Description"
              onChange={(description) => updateContent({ description })}
            />
          ) : (
            <BuilderHtmlContent html={content.description} tag="span" />
          )}
        </p>
      )}
      {(canEdit || content.buttonText) &&
        (canEdit ? (
          <span className={SITES_THEME_BUTTON_CLASS} style={buttonStyles}>
            {renderButtonLabel()}
          </span>
        ) : content.buttonLink ? (
          <StorefrontLink href={content.buttonLink} preview={builderCanvas} className={SITES_THEME_BUTTON_CLASS} style={buttonStyles}>
            {renderButtonLabel()}
          </StorefrontLink>
        ) : (
          <span className={SITES_THEME_BUTTON_CLASS} style={buttonStyles}>
            {renderButtonLabel()}
          </span>
        ))}
    </div>
  );
}
