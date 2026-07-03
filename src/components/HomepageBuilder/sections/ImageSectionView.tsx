import React from 'react';
import { ImageSection } from '../../../types/homepage';
import { useBuilderMediaOptional } from '../media/BuilderMediaContext';
import './ImageSection.css';

interface ImageSectionViewProps {
  section: ImageSection & { id: string };
  storeId?: string;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<ImageSection>) => void;
}

export default function ImageSectionView({ section, storeId, editMode, onUpdateSection }: ImageSectionViewProps) {
  const { settings, content } = section;
  const media = useBuilderMediaOptional();

  const widthClass =
    settings.width === 'small'
      ? 'image-section__inner--width-small'
      : settings.width === 'large'
        ? 'image-section__inner--width-large'
        : settings.width === 'full'
          ? 'image-section__inner--width-full'
          : 'image-section__inner--width-medium';
  const alignClass =
    settings.alignment === 'left'
      ? 'image-section--align-left'
      : settings.alignment === 'right'
        ? 'image-section--align-right'
        : 'image-section--align-center';
  const verticalAlignClass =
    settings.verticalAlignment === 'center'
      ? 'image-section--valign-center'
      : settings.verticalAlignment === 'bottom'
        ? 'image-section--valign-bottom'
        : 'image-section--valign-top';
  const imageObjectPosition =
    settings.alignment === 'left'
      ? 'left center'
      : settings.alignment === 'right'
        ? 'right center'
        : 'center center';

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
    <div className={`image-section ${alignClass} ${verticalAlignClass}`}>
      <div className={`image-section__inner ${widthClass}`}>
        {content.url ? (
          <figure className="image-section__figure">
            <img
              src={content.url}
              alt={content.alt}
              style={{
                width: '100%',
                objectFit: 'cover',
                objectPosition: imageObjectPosition,
                borderRadius: settings.rounded ? '8px' : '0',
                boxShadow: settings.shadow ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                cursor: editMode && media ? 'pointer' : undefined,
              }}
              onClick={editMode && media ? openPicker : undefined}
              title={editMode ? 'Click to change image' : undefined}
            />
            {editMode && onUpdateSection ? (
              <figcaption
                className="image-section__caption sites-inline-editable"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onUpdateSection({ content: { ...content, alt: e.currentTarget.textContent || '' } })}
              >
                {content.alt || 'Caption'}
              </figcaption>
            ) : content.alt ? (
              <figcaption className="image-section__caption">{content.alt}</figcaption>
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
