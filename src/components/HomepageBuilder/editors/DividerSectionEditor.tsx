import React from 'react';
import { DividerSection } from '../../../types/homepage';

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
        <select
          className="panel-select"
          value={settings.style}
          onChange={(e) =>
            onUpdate({ settings: { ...settings, style: e.target.value as DividerSection['settings']['style'] } })
          }
        >
          <option value="line">Line</option>
          <option value="dots">Dots</option>
          <option value="space">Spacer only</option>
        </select>
      </div>

      {settings.style !== 'space' && (
        <>
          <div className="panel-section">
            <label className="panel-label">Width</label>
            <select
              className="panel-select"
              value={settings.width}
              onChange={(e) =>
                onUpdate({ settings: { ...settings, width: e.target.value as DividerSection['settings']['width'] } })
              }
            >
              <option value="narrow">Narrow</option>
              <option value="medium">Medium</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div className="panel-section">
            <label className="panel-label">Thickness</label>
            <select
              className="panel-select"
              value={settings.thickness}
              onChange={(e) =>
                onUpdate({
                  settings: { ...settings, thickness: e.target.value as DividerSection['settings']['thickness'] },
                })
              }
            >
              <option value="thin">Thin</option>
              <option value="medium">Medium</option>
              <option value="thick">Thick</option>
            </select>
          </div>
          <div className="panel-section">
            <label className="panel-label">Color</label>
            <input
              type="color"
              className="panel-input"
              value={settings.color || '#dadce0'}
              onChange={(e) => onUpdate({ settings: { ...settings, color: e.target.value } })}
            />
          </div>
        </>
      )}

      <div className="panel-section">
        <label className="panel-label">Spacing</label>
        <select
          className="panel-select"
          value={settings.spacing}
          onChange={(e) =>
            onUpdate({ settings: { ...settings, spacing: e.target.value as DividerSection['settings']['spacing'] } })
          }
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
    </>
  );
}
