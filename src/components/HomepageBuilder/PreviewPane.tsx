import React from 'react';
import { HomepageLayout } from '../../types/homepage';
import SectionRenderer from './sections/SectionRenderer';

interface PreviewPaneProps {
  layout: HomepageLayout;
}

export default function PreviewPane({ layout }: PreviewPaneProps) {
  return (
    <div className="preview-pane">
      <div className="preview-header">
        Live Preview
      </div>
      <div
        className="preview-content"
        style={{
          color: layout.theme.textColor || '#1f2937',
          background: layout.theme.backgroundColor || '#ffffff',
          fontFamily: layout.theme.fontFamily || 'DM Sans, system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
          {layout.sections.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                color: '#9ca3af',
                textAlign: 'center',
              }}
            >
              <div>
                <p style={{ fontSize: '2rem', marginBottom: '12px' }}>👀</p>
                <p>Add sections to see a live preview here</p>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              {layout.sections.map((section) => (
                <div key={section.id} style={{ marginBottom: '20px' }}>
                  <SectionRenderer section={section} editMode={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
