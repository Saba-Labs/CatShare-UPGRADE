import React from 'react';
import { HomepageSection, ThemeSettings } from '../../types/homepage';
import TextSectionEditor from './editors/TextSectionEditor';
import CarouselSectionEditor from './editors/CarouselSectionEditor';
import GenericSectionEditor from './editors/GenericSectionEditor';

interface PropertiesPanelProps {
  selectedSectionId: string | null;
  sections: (HomepageSection & { id: string })[];
  theme: ThemeSettings;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
  storeId: string;
}

export default function PropertiesPanel({
  selectedSectionId,
  sections,
  theme,
  onUpdateSection,
  onUpdateTheme,
  storeId,
}: PropertiesPanelProps) {
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  if (!selectedSection) {
    return (
      <div className="properties-panel">
        <div className="panel-header">Theme Settings</div>
        <div className="panel-content">
          <div className="panel-section">
            <label className="panel-label">Primary Color</label>
            <input
              type="color"
              className="panel-input"
              value={theme.primaryColor || '#2563eb'}
              onChange={(e) => onUpdateTheme({ primaryColor: e.target.value })}
            />
          </div>

          <div className="panel-section">
            <label className="panel-label">Text Color</label>
            <input
              type="color"
              className="panel-input"
              value={theme.textColor || '#1f2937'}
              onChange={(e) => onUpdateTheme({ textColor: e.target.value })}
            />
          </div>

          <div className="panel-section">
            <label className="panel-label">Background Color</label>
            <input
              type="color"
              className="panel-input"
              value={theme.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdateTheme({ backgroundColor: e.target.value })}
            />
          </div>

          <div className="panel-section">
            <label className="panel-label">Accent Color</label>
            <input
              type="color"
              className="panel-input"
              value={theme.accentColor || '#dc2626'}
              onChange={(e) => onUpdateTheme({ accentColor: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="panel-header">Section Settings</div>
      <div className="panel-content">
        {selectedSection.type === 'text' && (
          <TextSectionEditor
            section={selectedSection as any}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}

        {selectedSection.type === 'carousel' && (
          <CarouselSectionEditor
            section={selectedSection as any}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}

        {/* Generic editor for other section types */}
        {!['text', 'carousel'].includes(selectedSection.type) && (
          <GenericSectionEditor
            section={selectedSection}
            storeId={storeId}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}
      </div>
    </div>
  );
}
