import React from 'react';
import { DividerSection } from '../../../types/homepage';
import ColorPickerField from '../ColorPickerField';
import SidebarDropdownField from '../SidebarDropdownField';

interface DividerSectionEditorProps {
  section: DividerSection & { id: string };
  onUpdate: (updates: Partial<DividerSection>) => void;
}

export default function DividerSectionEditor({ section, onUpdate }: DividerSectionEditorProps) {
  const { settings } = section;

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Style</label>
        <SidebarDropdownField
          ariaLabel="Divider style"
          value={settings.style}
          options={[
            { value: 'line', label: 'Line' },
            { value: 'dots', label: 'Dots' },
            { value: 'space', label: 'Spacer only' },
          ]}
          onChange={(next) => onUpdate({ settings: { ...settings, style: next as DividerSection['settings']['style'] } })}
        />
      </div>

      {settings.style !== 'space' && (
        <>
          <div className="panel-section">
            <label className="panel-label">Width</label>
            <SidebarDropdownField
              ariaLabel="Divider width"
              value={settings.width}
              options={[
                { value: 'narrow', label: 'Narrow' },
                { value: 'medium', label: 'Medium' },
                { value: 'full', label: 'Full' },
              ]}
              onChange={(next) => onUpdate({ settings: { ...settings, width: next as DividerSection['settings']['width'] } })}
            />
          </div>
          <div className="panel-section">
            <label className="panel-label">Thickness</label>
            <SidebarDropdownField
              ariaLabel="Divider thickness"
              value={settings.thickness}
              options={[
                { value: 'thin', label: 'Thin' },
                { value: 'medium', label: 'Medium' },
                { value: 'thick', label: 'Thick' },
              ]}
              onChange={(next) =>
                onUpdate({
                  settings: { ...settings, thickness: next as DividerSection['settings']['thickness'] },
                })
              }
            />
          </div>
          <ColorPickerField
            label="Color"
            value={settings.color || '#dadce0'}
            defaultValue="#dadce0"
            onChange={(color) => onUpdate({ settings: { ...settings, color } })}
          />
        </>
      )}

      <div className="panel-section">
        <label className="panel-label">Spacing</label>
        <SidebarDropdownField
          ariaLabel="Divider spacing"
          value={settings.spacing}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={(next) => onUpdate({ settings: { ...settings, spacing: next as DividerSection['settings']['spacing'] } })}
        />
      </div>
    </>
  );
}
