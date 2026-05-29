import { v4 as uuid } from 'uuid';
import { WebsiteModeConfig } from '../../types/homepage';
import SeoSettingsPanel from './SeoSettingsPanel';
import MediaPickerButton from './media/MediaPickerButton';
import StoreLinkPicker from './StoreLinkPicker';
import SidebarSection from './SidebarSection';

interface SiteSettingsPanelProps {
  websiteConfig: WebsiteModeConfig;
  storeId: string;
  storeSlug?: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
}

export default function SiteSettingsPanel({
  websiteConfig,
  storeId,
  storeSlug,
  onUpdateWebsiteConfig,
}: SiteSettingsPanelProps) {
  const { siteSettings } = websiteConfig;
  const navItems = siteSettings.navItems || [];

  return (
    <div className="sidebar-panel">
      <SidebarSection title="General" description="Name and logo shown in the site header.">
        <div className="sidebar-field">
          <label className="panel-label">Site name</label>
          <input
            className="panel-input"
            value={siteSettings.websiteName || ''}
            onChange={(e) =>
              onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, websiteName: e.target.value } })
            }
          />
        </div>
        <div className="sidebar-field">
          <label className="panel-label">Logo</label>
          <MediaPickerButton
            storeId={storeId}
            assetKey="site-logo"
            label="Upload logo"
            currentUrl={siteSettings.logoUrl}
            onUrl={(url) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, logoUrl: url } })}
          />
        </div>
      </SidebarSection>

      <p className="panel-hint" style={{ margin: '0 0 12px' }}>
        To edit the free-shipping bar, click it at the top of the page preview (above the logo).
      </p>

      <SidebarSection
        title="Navigation menu"
        description="Links in the header and mobile menu."
        action={
          <button
            type="button"
            className="btn-text"
            onClick={() =>
              onUpdateWebsiteConfig({
                siteSettings: {
                  ...siteSettings,
                  navItems: [...navItems, { id: uuid(), label: 'Link', href: '/' }],
                },
              })
            }
          >
            + Add
          </button>
        }
      >
        {navItems.length === 0 ? (
          <p className="sidebar-empty-hint">No menu links yet. Add one to get started.</p>
        ) : (
          <div className="sidebar-list">
            {navItems.map((item, index) => (
              <div key={item.id} className="sidebar-list-item">
                <span className="sidebar-list-item__index">Link {index + 1}</span>
                <div className="sidebar-field">
                  <label className="panel-label">Label</label>
                  <input
                    className="panel-input"
                    value={item.label}
                    onChange={(e) => updateNav(websiteConfig, item.id, { label: e.target.value }, onUpdateWebsiteConfig)}
                    placeholder="e.g. Shop"
                  />
                </div>
                <div className="sidebar-field">
                  <label className="panel-label">Destination</label>
                  <StoreLinkPicker
                    value={item.href}
                    websiteConfig={websiteConfig}
                    onChange={(href) =>
                      updateNav(websiteConfig, item.id, { href: sanitizeHref(href) }, onUpdateWebsiteConfig)
                    }
                  />
                </div>
                <div className="sidebar-list-item__actions">
                  <button
                    type="button"
                    className="btn-icon-sm"
                    disabled={index === 0}
                    onClick={() => moveNav(websiteConfig, item.id, -1, onUpdateWebsiteConfig)}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-icon-sm"
                    disabled={index === navItems.length - 1}
                    onClick={() => moveNav(websiteConfig, item.id, 1, onUpdateWebsiteConfig)}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-icon-sm danger"
                    onClick={() => removeNav(websiteConfig, item.id, onUpdateWebsiteConfig)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SidebarSection>

      <p className="panel-hint" style={{ margin: '0 0 12px' }}>
        To edit your storefront footer, click it at the bottom of the page preview — the same way you edit hero and other sections.
      </p>

      <SidebarSection title="SEO" description="Search and social preview for your live storefront.">
        <SeoSettingsPanel
          websiteConfig={websiteConfig}
          storeId={storeId}
          storeSlug={storeSlug}
          onUpdateWebsiteConfig={onUpdateWebsiteConfig}
          embedded
        />
      </SidebarSection>
    </div>
  );
}

function sanitizeHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function updateNav(
  websiteConfig: WebsiteModeConfig,
  id: string,
  updates: Partial<{ label: string; href: string }>,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    },
  });
}

function moveNav(
  websiteConfig: WebsiteModeConfig,
  id: string,
  dir: -1 | 1,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const items = [...(websiteConfig.siteSettings.navItems || [])];
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const next = idx + dir;
  if (next < 0 || next >= items.length) return;
  const [moved] = items.splice(idx, 1);
  items.splice(next, 0, moved);
  onUpdate({ siteSettings: { ...websiteConfig.siteSettings, navItems: items } });
}

function removeNav(
  websiteConfig: WebsiteModeConfig,
  id: string,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).filter((item) => item.id !== id),
    },
  });
}
