import React from 'react';
import { HomepageSection } from '../../types/homepage';
import ColorPickerField from './ColorPickerField';

interface SectionStyleControlsProps {
  section: HomepageSection & { id: string };
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function SectionStyleControls({ section, onUpdate }: SectionStyleControlsProps) {
  const settings = (section as { settings?: Record<string, unknown> }).settings || {};

  const patchSettings = (patch: Record<string, unknown>) => {
    onUpdate({ settings: { ...settings, ...patch } } as Partial<HomepageSection>);
  };

  const hasBackground = [
    'text',
    'banner',
    'cta',
    'announcement',
    'feature-card',
    'two-column-content',
    'content-grid',
    'testimonials',
    'featured-products',
    'category-showcase',
    'product-grid',
    'faq',
  ].includes(section.type);

  const hasPadding = ['text', 'feature-card', 'two-column-content', 'content-grid', 'faq'].includes(section.type);

  const hasAlignment = ['text', 'banner', 'cta', 'image'].includes(section.type);

  const alignmentKey =
    section.type === 'image' ? 'alignment' : section.type === 'banner' ? 'textAlignment' : 'alignment';

  return (
    <div className="section-style-controls">
      {hasAlignment && (
        <div className="sidebar-field">
          <label className="panel-label">Alignment</label>
          <select
            className="panel-select"
            value={(settings[alignmentKey] as string) || 'center'}
            onChange={(e) => patchSettings({ [alignmentKey]: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}

      {hasPadding && (
        <div className="sidebar-field">
          <label className="panel-label">Padding</label>
          <select
            className="panel-select"
            value={(settings.padding as string) || 'medium'}
            onChange={(e) => patchSettings({ padding: e.target.value })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      )}

      {hasBackground && (
        <ColorPickerField
          label="Background"
          value={(settings.backgroundColor as string) || '#ffffff'}
          onChange={(backgroundColor) => patchSettings({ backgroundColor })}
        />
      )}

      {section.type === 'banner' && (
        <div className="sidebar-field">
          <label className="panel-label">Height</label>
          <select
            className="panel-select"
            value={(settings.height as string) || 'large'}
            onChange={(e) => patchSettings({ height: e.target.value })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      )}

      {section.type === 'text' && (
        <div className="sidebar-field">
          <label className="panel-label">Text size</label>
          <select
            className="panel-select"
            value={(settings.fontSize as string) || 'medium'}
            onChange={(e) => patchSettings({ fontSize: e.target.value })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra large</option>
          </select>
        </div>
      )}
    </div>
  );
}
