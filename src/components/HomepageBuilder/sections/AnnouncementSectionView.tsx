import React from 'react';
import { AnnouncementSection } from '../../../types/homepage';
import { announcementIcon, IconX } from '../../Storefront/StorefrontIcons';

interface AnnouncementSectionViewProps {
  section: AnnouncementSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<AnnouncementSection>) => void;
}

export default function AnnouncementSectionView({ section, editMode, onUpdateSection }: AnnouncementSectionViewProps) {
  const { settings, content } = section;

  return (
    <div
      className="announcement-bar-section"
      style={{
        background: settings.backgroundColor || '#fef3c7',
        color: settings.textColor || '#92400e',
        padding: '12px 16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {settings.icon !== 'none' && (
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
          {announcementIcon(settings.icon, 18)}
        </span>
      )}
      {editMode && onUpdateSection ? (
        <p
          className="sites-inline-editable"
          style={{ margin: 0, flex: 1, fontSize: '0.875rem' }}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdateSection({ content: { message: e.currentTarget.textContent || '' } })}
        >
          {content.message}
        </p>
      ) : (
        <p style={{ margin: 0, flex: 1, fontSize: '0.875rem' }}>{content.message}</p>
      )}
      {settings.dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 4,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconX size={16} />
        </button>
      )}
    </div>
  );
}
