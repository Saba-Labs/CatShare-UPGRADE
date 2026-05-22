import React from 'react';
import { TextSection } from '../../../types/homepage';

interface TextSectionEditorProps {
  section: TextSection & { id: string };
  onUpdate: (updates: Partial<TextSection>) => void;
}

export default function TextSectionEditor({ section, onUpdate }: TextSectionEditorProps) {
  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Content</label>
        <textarea
          className="panel-input"
          style={{ minHeight: '80px', fontFamily: 'inherit' }}
          value={section.content.text}
          onChange={(e) =>
            onUpdate({
              content: { ...section.content, text: e.target.value },
            })
          }
          placeholder="Enter your text content..."
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Alignment</label>
        <select
          className="panel-select"
          value={section.settings.alignment}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, alignment: e.target.value as any },
            })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Font Size</label>
        <select
          className="panel-select"
          value={section.settings.fontSize}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, fontSize: e.target.value as any },
            })
          }
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xlarge">Extra Large</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Padding</label>
        <select
          className="panel-select"
          value={section.settings.padding}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, padding: e.target.value as any },
            })
          }
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Text Color</label>
        <input
          type="color"
          className="panel-input"
          value={section.settings.textColor || '#000000'}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, textColor: e.target.value },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Background Color</label>
        <input
          type="color"
          className="panel-input"
          value={section.settings.backgroundColor || '#ffffff'}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, backgroundColor: e.target.value },
            })
          }
        />
      </div>
    </>
  );
}
