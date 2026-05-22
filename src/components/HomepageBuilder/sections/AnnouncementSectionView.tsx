import React from 'react';
import { AnnouncementSection } from '../../../types/homepage';

interface AnnouncementSectionViewProps {
  section: AnnouncementSection & { id: string };
  editMode?: boolean;
}

export default function AnnouncementSectionView({ section }: AnnouncementSectionViewProps) {
  const { settings, content } = section;

  const iconMap = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    none: '',
  };

  return (
    <div
      style={{
        background: settings.backgroundColor || '#fef3c7',
        color: settings.textColor || '#92400e',
        padding: '12px 16px',
        borderRadius: '6px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      {settings.icon !== 'none' && <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{iconMap[settings.icon]}</span>}
      <p style={{ margin: 0, flex: 1, fontSize: '0.875rem' }}>{content.message}</p>
      {settings.dismissible && (
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            fontSize: '1rem',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
