import React from 'react';
import { v4 as uuid } from 'uuid';
import { WebsiteModeConfig } from '../../types/homepage';

interface PagesPanelProps {
  websiteConfig: WebsiteModeConfig;
  editingPageId: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onSelectEditingPage: (pageId: string) => void;
}

export default function PagesPanel({
  websiteConfig,
  editingPageId,
  onUpdateWebsiteConfig,
  onSelectEditingPage,
}: PagesPanelProps) {
  const customPages = websiteConfig.pages.custom || [];

  const addPage = () => {
    const nextIndex = customPages.length + 1;
    const pageId = uuid();
    const title = `Page ${nextIndex}`;
    const slug = `page-${nextIndex}`;
    onUpdateWebsiteConfig({
      pages: {
        ...websiteConfig.pages,
        custom: [
          ...customPages,
          {
            id: pageId,
            title,
            slug,
            layout: { sections: [], theme: { ...websiteConfig.pages.home.theme } },
          },
        ],
      },
      siteSettings: {
        ...websiteConfig.siteSettings,
        navItems: [
          ...websiteConfig.siteSettings.navItems,
          { id: uuid(), label: title, href: `/${slug}` },
        ],
      },
    });
    onSelectEditingPage(pageId);
  };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-header">
        <h3>Pages</h3>
        <button type="button" className="btn-text" onClick={addPage}>
          + Add
        </button>
      </div>
      <div className="pages-list">
        <button
          type="button"
          className={`page-list-item ${editingPageId === 'home' ? 'active' : ''}`}
          onClick={() => onSelectEditingPage('home')}
        >
          <span className="page-list-icon">⌂</span>
          <span className="page-list-label">Home</span>
          <span className="page-list-badge">Default</span>
        </button>
        {customPages.map((page, index) => (
          <div key={page.id} className={`page-list-item-wrap ${editingPageId === page.id ? 'active' : ''}`}>
            <button type="button" className="page-list-item" onClick={() => onSelectEditingPage(page.id)}>
              <span className="page-list-icon">📄</span>
              <span className="page-list-label">{page.title}</span>
            </button>
            <div className="page-list-actions">
              <button
                type="button"
                className="btn-icon-sm"
                title="Move up"
                disabled={index === 0}
                onClick={() => reorderPage(websiteConfig, page.id, -1, onUpdateWebsiteConfig)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-icon-sm"
                title="Move down"
                disabled={index === customPages.length - 1}
                onClick={() => reorderPage(websiteConfig, page.id, 1, onUpdateWebsiteConfig)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-icon-sm danger"
                title="Remove"
                onClick={() => removePage(websiteConfig, page.id, onUpdateWebsiteConfig, editingPageId, onSelectEditingPage)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function reorderPage(
  websiteConfig: WebsiteModeConfig,
  pageId: string,
  direction: -1 | 1,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  const pages = [...(websiteConfig.pages.custom || [])];
  const idx = pages.findIndex((p) => p.id === pageId);
  if (idx < 0) return;
  const next = idx + direction;
  if (next < 0 || next >= pages.length) return;
  const [moved] = pages.splice(idx, 1);
  pages.splice(next, 0, moved);
  onUpdateWebsiteConfig({ pages: { ...websiteConfig.pages, custom: pages } });
}

function removePage(
  websiteConfig: WebsiteModeConfig,
  pageId: string,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void,
  editingPageId: string,
  onSelectEditingPage: (id: string) => void
) {
  const page = (websiteConfig.pages.custom || []).find((p) => p.id === pageId);
  onUpdateWebsiteConfig({
    pages: {
      ...websiteConfig.pages,
      custom: (websiteConfig.pages.custom || []).filter((p) => p.id !== pageId),
    },
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: websiteConfig.siteSettings.navItems.filter((item) => item.href !== `/${page?.slug || ''}`),
    },
  });
  if (editingPageId === pageId) onSelectEditingPage('home');
}
