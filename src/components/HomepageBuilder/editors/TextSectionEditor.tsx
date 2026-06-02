import React from 'react';
import { TextSection } from '../../../types/homepage';
import ColorPickerField from '../ColorPickerField';
import SidebarDropdownField from '../SidebarDropdownField';

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
        <SidebarDropdownField
          ariaLabel="Text alignment"
          value={section.settings.alignment}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, alignment: next as any },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Font Size</label>
        <SidebarDropdownField
          ariaLabel="Text font size"
          value={section.settings.fontSize}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
            { value: 'xlarge', label: 'Extra Large' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, fontSize: next as any },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Padding</label>
        <SidebarDropdownField
          ariaLabel="Text padding"
          value={section.settings.padding}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, padding: next as any },
            })
          }
        />
      </div>

      <ColorPickerField
        label="Text"
        value={section.settings.textColor || '#000000'}
        defaultValue="#000000"
        onChange={(textColor) => onUpdate({ settings: { ...section.settings, textColor } })}
      />

      <ColorPickerField
        label="Background"
        value={section.settings.backgroundColor || '#ffffff'}
        onChange={(backgroundColor) => onUpdate({ settings: { ...section.settings, backgroundColor } })}
      />
    </>
  );
}
