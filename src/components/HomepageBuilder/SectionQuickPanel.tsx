import React from 'react';
import { HomepageSection } from '../../types/homepage';
import { SECTION_TYPE_LABELS } from '../../config/homepageBuilderConfig';
import TextSectionEditor from './editors/TextSectionEditor';
import CarouselSectionEditor from './editors/CarouselSectionEditor';
import GenericSectionEditor from './editors/GenericSectionEditor';
import FaqSectionEditor from './editors/FaqSectionEditor';
import EmbedSectionEditor from './editors/EmbedSectionEditor';
import DividerSectionEditor from './editors/DividerSectionEditor';
import SectionStyleControls from './SectionStyleControls';

interface SectionQuickPanelProps {
  section: HomepageSection & { id: string };
  storeId: string;
  onUpdate: (updates: Partial<HomepageSection>) => void;
  onBack: () => void;
}

export default function SectionQuickPanel({ section, storeId, onUpdate, onBack }: SectionQuickPanelProps) {
  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Back
        </button>
        <h3>{SECTION_TYPE_LABELS[section.type] || 'Section'}</h3>
      </div>
      <p className="sidebar-hint">Click text on the page to edit inline. Use these controls for advanced options.</p>
      <SectionStyleControls section={section} onUpdate={onUpdate} />
      <div className="sidebar-panel-section">
        {section.type === 'text' && <TextSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'carousel' && (
          <CarouselSectionEditor section={section as any} storeId={storeId} onUpdate={onUpdate} />
        )}
        {section.type === 'faq' && <FaqSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'embed' && <EmbedSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'divider' && <DividerSectionEditor section={section as any} onUpdate={onUpdate} />}
        {!['text', 'carousel', 'faq', 'embed', 'divider'].includes(section.type) && (
          <GenericSectionEditor section={section} storeId={storeId} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}
