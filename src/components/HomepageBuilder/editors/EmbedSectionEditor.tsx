import React from 'react';
import { EmbedSection } from '../../../types/homepage';
import { normalizeEmbedUrl } from '../../../utils/embedUrl';
import SidebarDropdownField from '../SidebarDropdownField';

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
        <SidebarDropdownField
          ariaLabel="Embed aspect ratio"
          value={section.settings.aspectRatio}
          options={[
            { value: '16:9', label: '16:9' },
            { value: '4:3', label: '4:3' },
            { value: 'auto', label: 'Auto height' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, aspectRatio: next as EmbedSection['settings']['aspectRatio'] },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Max width</label>
        <SidebarDropdownField
          ariaLabel="Embed max width"
          value={section.settings.maxWidth}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'full', label: 'Full' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, maxWidth: next as EmbedSection['settings']['maxWidth'] },
            })
          }
        />
      </div>
    </>
  );
}
