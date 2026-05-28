import React from 'react';
import { EmbedSection } from '../../../types/homepage';
import { normalizeEmbedUrl } from '../../../utils/embedUrl';

interface EmbedSectionViewProps {
  section: EmbedSection & { id: string };
  editMode?: boolean;
}

export default function EmbedSectionView({ section, editMode }: EmbedSectionViewProps) {
  const { settings, content } = section;
  const embedSrc = normalizeEmbedUrl(content.embedUrl);
  const maxWidthMap = { small: '480px', medium: '720px', full: '100%' };
  const aspectPadding = { '16:9': '56.25%', '4:3': '75%', auto: '0' };
  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  return (
    <div
      className="embed-section"
      style={{ display: 'flex', justifyContent: alignMap[settings.alignment], width: '100%' }}
    >
      <div style={{ width: '100%', maxWidth: maxWidthMap[settings.maxWidth] }}>
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
