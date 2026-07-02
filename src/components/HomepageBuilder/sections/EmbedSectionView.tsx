import React from 'react';
import { EmbedSection } from '../../../types/homepage';
import { normalizeEmbedUrl } from '../../../utils/embedUrl';
import './EmbedSection.css';

interface EmbedSectionViewProps {
  section: EmbedSection & { id: string };
  editMode?: boolean;
}

export default function EmbedSectionView({ section, editMode }: EmbedSectionViewProps) {
  const { settings, content } = section;
  const embedSrc = normalizeEmbedUrl(content.embedUrl);
  const aspectPadding = { '16:9': '56.25%', '4:3': '75%', auto: '0' };
  const alignClass =
    settings.alignment === 'left'
      ? 'embed-section--align-left'
      : settings.alignment === 'right'
        ? 'embed-section--align-right'
        : 'embed-section--align-center';
  const maxWidthClass =
    settings.maxWidth === 'small'
      ? 'embed-section__inner--max-small'
      : settings.maxWidth === 'full'
        ? 'embed-section__inner--max-full'
        : 'embed-section__inner--max-medium';

  return (
    <div className={`embed-section ${alignClass}`}>
      <div className={`embed-section__inner ${maxWidthClass}`}>
        {content.title && <h3 className="embed-section-title">{content.title}</h3>}
        {embedSrc ? (
          settings.aspectRatio === 'auto' ? (
            <iframe
              src={embedSrc}
              title={content.title || 'Embedded content'}
              className="embed-iframe-auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div
              className="embed-aspect-wrap"
              style={{ paddingBottom: aspectPadding[settings.aspectRatio], position: 'relative' }}
            >
              <iframe
                src={embedSrc}
                title={content.title || 'Embedded content'}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 8 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )
        ) : (
          <div className="embed-placeholder">
            {editMode ? 'Add embed URL in block settings →' : 'Embedded content'}
          </div>
        )}
      </div>
    </div>
  );
}
