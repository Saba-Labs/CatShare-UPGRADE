import React from 'react';
import { AnnouncementSection } from '../../../types/homepage';
import { announcementIcon, IconX } from '../../Storefront/StorefrontIcons';
import './AnnouncementSection.css';

const ANNOUNCEMENT_FONT_SIZES: Record<NonNullable<AnnouncementSection['settings']['fontSize']>, string> = {
  small: '0.75rem',
  medium: '0.875rem',
  large: '1.125rem',
};

const ANNOUNCEMENT_ICON_SIZES: Record<NonNullable<AnnouncementSection['settings']['fontSize']>, number> = {
  small: 15,
  medium: 18,
  large: 22,
};

interface AnnouncementSectionViewProps {
  section: AnnouncementSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
  onUpdateSection?: (updates: Partial<AnnouncementSection>) => void;
}

export default function AnnouncementSectionView({
  section,
  editMode,
  builderCanvas = false,
  onUpdateSection,
}: AnnouncementSectionViewProps) {
  const { settings, content } = section;
  const animation = settings.animation || 'none';
  const alignment = settings.alignment || 'center';
  const fontSize = settings.fontSize || 'medium';
  const messageFontSize = ANNOUNCEMENT_FONT_SIZES[fontSize];
  const iconSize = ANNOUNCEMENT_ICON_SIZES[fontSize];
  const showAnimation = animation !== 'none' && (!editMode || builderCanvas);
  const useMarquee = animation === 'marquee' && showAnimation;
  const usePulse = animation === 'pulse' && showAnimation;
  const canInlineEdit = editMode && onUpdateSection && !useMarquee;
  const barBackground = settings.backgroundColor || '#fef3c7';

  return (
    <div
      className={`announcement-bar-section sites-section-pad--compact announcement-bar-section--size-${fontSize} announcement-bar-section--align-${alignment}${
        usePulse ? ' announcement-bar-section--pulse' : ''
      }${useMarquee ? ' announcement-bar-section--marquee' : ''}`}
      style={{
        background: barBackground,
        color: settings.textColor || '#92400e',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        fontSize: messageFontSize,
      }}
    >
      {settings.icon !== 'none' && (
        <span className="announcement-bar-section__icon" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
          {announcementIcon(settings.icon, iconSize)}
        </span>
      )}
      {useMarquee ? (
        <div className="announcement-bar-section__marquee" aria-live="polite">
          <div className="announcement-bar-section__marquee-track">
            <p className="announcement-bar-section__marquee-text">{content.message}</p>
            <span className="announcement-bar-section__marquee-spacer" aria-hidden />
            <p className="announcement-bar-section__marquee-text" aria-hidden>
              {content.message}
            </p>
            <span className="announcement-bar-section__marquee-spacer" aria-hidden />
          </div>
        </div>
      ) : canInlineEdit ? (
        <p
          className="announcement-bar-section__message sites-inline-editable"
          style={{ textAlign: alignment, fontSize: messageFontSize }}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdateSection({ content: { message: e.currentTarget.textContent || '' } })}
        >
          {content.message}
        </p>
      ) : (
        <p className="announcement-bar-section__message">{content.message}</p>
      )}
      {settings.dismissible && (
        <button
          type="button"
          className="announcement-bar-section__dismiss"
          aria-label="Dismiss"
        >
          <IconX size={16} />
        </button>
      )}
    </div>
  );
}
