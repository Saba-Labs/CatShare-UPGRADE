import React, { useMemo } from 'react';
import { HomepageLayout } from '../../types/homepage';
import SectionRenderer from './sections/SectionRenderer';
import { getBlockInnerStyle, getBlockRowStyle } from '../../utils/blockLayout';
import WebsiteFooter from '../WebsiteBuilder/WebsiteFooter';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';

interface PreviewPaneProps {
  layout: HomepageLayout;
}

/** Matches HomePageRuntime / live storefront — no extra padding or grid gaps. */
export default function PreviewPane({ layout }: PreviewPaneProps) {
  const sections = useMemo(
    () => [...(layout.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [layout.sections]
  );
  const siteSettings = layout.websiteConfig?.siteSettings;
  return (
    <div className="preview-pane">
      <div className="preview-header">Live Preview</div>
      <div
        className="preview-content preview-content--document"
        style={{
          color: layout.theme.textColor || '#1f2937',
          background: layout.theme.backgroundColor || '#ffffff',
          fontFamily: layout.theme.fontFamily || 'DM Sans, system-ui, sans-serif',
        }}
      >
        {siteSettings ? (
          <StorefrontSiteHeader siteSettings={siteSettings} preview />
        ) : null}
        {sections.length === 0 ? (
          <div className="preview-empty">
            <p style={{ fontSize: '2rem', marginBottom: '12px' }}>👀</p>
            <p>Add blocks to see a live preview here</p>
          </div>
        ) : (
          <main className="preview-document-stack">
            {sections.map((section) => (
              <div key={section.id} style={getBlockRowStyle(section.blockLayout)}>
                <div style={getBlockInnerStyle(section.blockLayout)}>
                  <SectionRenderer section={section} theme={layout.theme} editMode={false} />
                </div>
              </div>
            ))}
          </main>
        )}
        {siteSettings && (
          <div className="sites-editor-footer-preview">
            <WebsiteFooter siteSettings={siteSettings} previewMode />
          </div>
        )}
      </div>
    </div>
  );
}
