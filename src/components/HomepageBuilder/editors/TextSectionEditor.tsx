import React from 'react';
import { TextSection } from '../../../types/homepage';

interface TextSectionEditorProps {
  section: TextSection & { id: string };
  onUpdate: (updates: Partial<TextSection>) => void;
}

export default function TextSectionEditor({ section, onUpdate }: TextSectionEditorProps) {
  return (
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
  );
}
