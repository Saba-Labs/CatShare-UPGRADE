import React from 'react';
import { HomepageSection } from '../../types/homepage';
import ColorPickerField from './ColorPickerField';
import SidebarDropdownField from './SidebarDropdownField';

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
          <SidebarDropdownField
            ariaLabel="Section alignment"
            value={(settings[alignmentKey] as string) || 'center'}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(next) => patchSettings({ [alignmentKey]: next })}
          />
        </div>
      )}

      {hasPadding && (
        <div className="sidebar-field">
          <label className="panel-label">Padding</label>
          <SidebarDropdownField
            ariaLabel="Section padding"
            value={(settings.padding as string) || 'medium'}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
            onChange={(next) => patchSettings({ padding: next })}
          />
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
          <SidebarDropdownField
            ariaLabel="Banner height"
            value={(settings.height as string) || 'large'}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
            onChange={(next) => patchSettings({ height: next })}
          />
        </div>
      )}

      {section.type === 'text' && (
        <div className="sidebar-field">
          <label className="panel-label">Text size</label>
          <SidebarDropdownField
            ariaLabel="Text size"
            value={(settings.fontSize as string) || 'medium'}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
              { value: 'xlarge', label: 'Extra large' },
            ]}
            onChange={(next) => patchSettings({ fontSize: next })}
          />
        </div>
      )}
    </div>
  );
}
