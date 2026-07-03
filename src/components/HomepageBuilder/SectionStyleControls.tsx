import React from 'react';
import type { AnnouncementSection, HomepageSection } from '../../types/homepage';
import ColorPickerField from './ColorPickerField';
import SidebarDropdownField from './SidebarDropdownField';

const SECTION_TYPES_WITH_STYLE_CONTROLS = new Set<HomepageSection['type']>([
  'image',
  'text',
  'banner',
  'cta',
  'announcement',
  'feature-card',
  'two-column-content',
  'content-grid',
  'testimonials',
  'featured-products',
  'product-grid',
  'faq',
]);

export function sectionHasStyleControls(type: HomepageSection['type']): boolean {
  return SECTION_TYPES_WITH_STYLE_CONTROLS.has(type);
}

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
    'feature-card',
    'two-column-content',
    'content-grid',
    'testimonials',
    'featured-products',
    'product-grid',
    'faq',
  ].includes(section.type);

  const hasPadding = ['text', 'feature-card', 'two-column-content', 'content-grid', 'faq'].includes(section.type);

  const hasAlignment = ['text', 'banner', 'cta'].includes(section.type);

  const alignmentKey =
    section.type === 'banner' || section.type === 'cta' ? 'textAlignment' : 'alignment';

  const alignmentLabel =
    section.type === 'banner' || section.type === 'cta' ? 'Text alignment' : 'Alignment';

  return (
    <div className="section-style-controls">
      {section.type === 'image' && (
        <>
          <div className="sidebar-field">
            <label className="panel-label">Horizontal alignment</label>
            <SidebarDropdownField
              ariaLabel="Image horizontal alignment"
              value={(settings.alignment as string) || 'center'}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(next) => patchSettings({ alignment: next })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Vertical alignment</label>
            <SidebarDropdownField
              ariaLabel="Image vertical alignment"
              value={(settings.verticalAlignment as string) || 'top'}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'bottom', label: 'Bottom' },
              ]}
              onChange={(next) => patchSettings({ verticalAlignment: next })}
            />
          </div>
        </>
      )}

      {hasAlignment && (
        <div className="sidebar-field">
          <label className="panel-label">{alignmentLabel}</label>
          <SidebarDropdownField
            ariaLabel={alignmentLabel}
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

      {section.type === 'announcement' && (
        <>
          <div className="sidebar-field">
            <label className="panel-label">Alignment</label>
            <SidebarDropdownField
              ariaLabel="Announcement alignment"
              value={(settings.alignment as string) || 'center'}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(next) =>
                patchSettings({ alignment: next as AnnouncementSection['settings']['alignment'] })
              }
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Font size</label>
            <SidebarDropdownField
              ariaLabel="Announcement font size"
              value={(settings.fontSize as string) || 'medium'}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
              onChange={(next) =>
                patchSettings({ fontSize: next as AnnouncementSection['settings']['fontSize'] })
              }
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Animation</label>
            <SidebarDropdownField
              ariaLabel="Announcement animation"
              value={(settings.animation as string) || 'none'}
              options={[
                { value: 'none', label: 'None' },
                { value: 'marquee', label: 'Scrolling marquee' },
                { value: 'pulse', label: 'Pulse attention' },
              ]}
              onChange={(next) =>
                patchSettings({ animation: next as AnnouncementSection['settings']['animation'] })
              }
            />
          </div>
        </>
      )}

      {hasBackground && (
        <ColorPickerField
          label="Background"
          value={(settings.backgroundColor as string) || (section.type === 'banner' ? '#2563eb' : '#ffffff')}
          defaultValue={section.type === 'banner' ? '#2563eb' : '#ffffff'}
          onChange={(backgroundColor) => patchSettings({ backgroundColor })}
        />
      )}

      {section.type === 'banner' && (
        <>
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
          <div className="sidebar-field">
            <label className="panel-label">
              Overlay darkness ({Math.round(((settings.overlayOpacity as number) ?? 0.3) * 100)}%)
            </label>
            <input
              type="range"
              className="panel-input"
              min={0}
              max={1}
              step={0.05}
              value={(settings.overlayOpacity as number) ?? 0.3}
              onChange={(e) => patchSettings({ overlayOpacity: parseFloat(e.target.value) })}
              aria-label="Banner overlay darkness"
            />
          </div>
        </>
      )}

      {section.type === 'text' && (
        <>
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
          <ColorPickerField
            label="Text"
            value={(settings.textColor as string) || '#000000'}
            defaultValue="#000000"
            onChange={(textColor) => patchSettings({ textColor })}
          />
        </>
      )}
    </div>
  );
}
