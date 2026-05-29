import { WebsiteModeConfig } from '../../types/homepage';
import SidebarSection from './SidebarSection';

interface PagesPanelProps {
  websiteConfig: WebsiteModeConfig;
  editingPageId: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onSelectEditingPage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
}

export default function PagesPanel({
  websiteConfig,
  editingPageId,
  onUpdateWebsiteConfig,
  onSelectEditingPage,
  onAddPage,
  onRemovePage,
}: PagesPanelProps) {
  const customPages = websiteConfig.pages.custom || [];

  return (
    <div className="sidebar-panel">
      <SidebarSection
        title="Pages"
        description="Switch which page you are editing in the canvas."
        action={
          <button type="button" className="btn-text" onClick={onAddPage}>
            + Add
          </button>
        }
      >
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
                  onClick={() => onRemovePage(page.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </SidebarSection>
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
