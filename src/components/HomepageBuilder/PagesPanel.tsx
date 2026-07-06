import { WebsiteModeConfig } from '../../types/homepage';
import SidebarSection from './SidebarSection';
import { FiChevronDown, FiChevronUp, FiFile, FiGrid, FiHome, FiPlus, FiTrash2 } from './builderSidebarIcons';

interface PagesPanelProps {
  websiteConfig: WebsiteModeConfig;
  editingPageId: string;
  previewCategoryId?: string | null;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onSelectEditingPage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onOpenShopCatalog?: () => void;
}

export default function PagesPanel({
  websiteConfig,
  editingPageId,
  previewCategoryId = null,
  onUpdateWebsiteConfig,
  onSelectEditingPage,
  onAddPage,
  onRemovePage,
  onOpenShopCatalog,
}: PagesPanelProps) {
  const customPages = websiteConfig.pages.custom || [];
  const shopCatalogActive = previewCategoryId != null;

  return (
    <div className="sidebar-panel">
      <SidebarSection
        title="Pages"
        icon={<FiFile />}
        description="Switch the page you edit"
        action={
          <button type="button" className="btn-icon-action" onClick={onAddPage} title="Add page" aria-label="Add page">
            <FiPlus aria-hidden />
          </button>
        }
      >
        <div className="pages-list">
          <button
            type="button"
            className={`page-list-item ${editingPageId === 'home' && !shopCatalogActive ? 'active' : ''}`}
            onClick={() => onSelectEditingPage('home')}
            title="Home — your marketing cover page"
          >
            <span className="page-list-icon" aria-hidden>
              <FiHome />
            </span>
            <span className="page-list-label">Home</span>
            <span className="page-list-badge">★</span>
          </button>

          {onOpenShopCatalog ? (
            <button
              type="button"
              className={`page-list-item ${shopCatalogActive ? 'active' : ''}`}
              onClick={onOpenShopCatalog}
              title="Shop catalog — built-in category pages with your full product list"
            >
              <span className="page-list-icon" aria-hidden>
                <FiGrid />
              </span>
              <span className="page-list-label">Shop catalog</span>
              <span className="page-list-badge page-list-badge--builtin">Built-in</span>
            </button>
          ) : null}

          {customPages.map((page, index) => (
            <div key={page.id} className={`page-list-item-wrap ${editingPageId === page.id && !shopCatalogActive ? 'active' : ''}`}>
              <button
                type="button"
                className="page-list-item"
                onClick={() => onSelectEditingPage(page.id)}
                title={page.title}
              >
                <span className="page-list-icon" aria-hidden>
                  <FiFile />
                </span>
                <span className="page-list-label">{page.title}</span>
              </button>
              <div className="page-list-actions">
                <button
                  type="button"
                  className="btn-icon-sm"
                  title="Move up"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => reorderPage(websiteConfig, page.id, -1, onUpdateWebsiteConfig)}
                >
                  <FiChevronUp aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-icon-sm"
                  title="Move down"
                  aria-label="Move down"
                  disabled={index === customPages.length - 1}
                  onClick={() => reorderPage(websiteConfig, page.id, 1, onUpdateWebsiteConfig)}
                >
                  <FiChevronDown aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-icon-sm danger"
                  title="Remove"
                  aria-label="Remove page"
                  onClick={() => onRemovePage(page.id)}
                >
                  <FiTrash2 aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="panel-hint" style={{ marginTop: 12 }}>
          Home is your custom storefront cover. <strong>Shop catalog</strong> is always underneath — category
          pages show your full product list with filters and ordering.
        </p>
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
