import React from 'react';
import { ImageSection } from '../../../types/homepage';
import { useBuilderMediaOptional } from '../media/BuilderMediaContext';

interface ImageSectionViewProps {
  section: ImageSection & { id: string };
  storeId?: string;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<ImageSection>) => void;
}

export default function ImageSectionView({ section, storeId, editMode, onUpdateSection }: ImageSectionViewProps) {
  const { settings, content } = section;
  const media = useBuilderMediaOptional();

  const widthMap = { small: '30%', medium: '50%', large: '80%', full: '100%' };
  const width = widthMap[settings.width];
  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  const openPicker = () => {
    if (!media || !storeId || !onUpdateSection) return;
    media.openMediaPicker({
      storeId,
      assetKey: `${section.id}-image`,
      title: 'Choose image',
      onSelect: (url) => onUpdateSection({ content: { ...content, url } }),
    });
  };

  return (
    <div style={{ display: 'flex', justifyContent: alignMap[settings.alignment as keyof typeof alignMap], width: '100%' }}>
      <div style={{ width }}>
        {content.url ? (
          <figure style={{ margin: 0 }}>
            <img
              src={content.url}
              alt={content.alt}
              style={{
                width: '100%',
                borderRadius: settings.rounded ? '8px' : '0',
                boxShadow: settings.shadow ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                cursor: editMode && media ? 'pointer' : undefined,
              }}
              onClick={editMode && media ? openPicker : undefined}
              title={editMode ? 'Click to change image' : undefined}
            />
            {editMode && onUpdateSection ? (
              <figcaption
                className="sites-inline-editable"
                style={{ marginTop: 8, fontSize: '0.85rem', color: '#5f6368', textAlign: 'center' }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onUpdateSection({ content: { ...content, alt: e.currentTarget.textContent || '' } })}
              >
                {content.alt || 'Caption'}
              </figcaption>
            ) : content.alt ? (
              <figcaption style={{ marginTop: 8, fontSize: '0.85rem', color: '#5f6368', textAlign: 'center' }}>
                {content.alt}
              </figcaption>
            ) : null}
          </figure>
        ) : (
          <button
            type="button"
            className="image-section-placeholder"
            disabled={!editMode || !media}
            onClick={editMode ? openPicker : undefined}
          >
            {editMode ? '+ Add image' : 'Image'}
          </button>
        )}
      </div>
    </div>
  );
}
