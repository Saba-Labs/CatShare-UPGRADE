import React from 'react';
import { EmbedSection } from '../../../types/homepage';
import { normalizeEmbedUrl } from '../../../utils/embedUrl';

interface EmbedSectionEditorProps {
  section: EmbedSection & { id: string };
  onUpdate: (updates: Partial<EmbedSection>) => void;
}

export default function EmbedSectionEditor({ section, onUpdate }: EmbedSectionEditorProps) {
  const preview = normalizeEmbedUrl(section.content.embedUrl);

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Embed URL</label>
        <input
          type="url"
          className="panel-input"
          placeholder="https://www.youtube.com/watch?v=..."
          value={section.content.embedUrl}
          onChange={(e) => onUpdate({ content: { ...section.content, embedUrl: e.target.value } })}
        />
        <p className="sidebar-hint" style={{ marginTop: 6 }}>
          YouTube, Vimeo, or any HTTPS iframe URL. Maps links supported.
        </p>
        {preview && preview !== section.content.embedUrl && (
          <p className="sidebar-hint">Preview URL: {preview}</p>
        )}
      </div>

      <div className="panel-section">
        <label className="panel-label">Caption (optional)</label>
        <input
          type="text"
          className="panel-input"
          value={section.content.title || ''}
          onChange={(e) => onUpdate({ content: { ...section.content, title: e.target.value } })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Aspect ratio</label>
        <select
          className="panel-select"
          value={section.settings.aspectRatio}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, aspectRatio: e.target.value as EmbedSection['settings']['aspectRatio'] },
            })
          }
        >
          <option value="16:9">16:9</option>
          <option value="4:3">4:3</option>
          <option value="auto">Auto height</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Max width</label>
        <select
          className="panel-select"
          value={section.settings.maxWidth}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, maxWidth: e.target.value as EmbedSection['settings']['maxWidth'] },
            })
          }
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="full">Full</option>
        </select>
      </div>
    </>
  );
}
