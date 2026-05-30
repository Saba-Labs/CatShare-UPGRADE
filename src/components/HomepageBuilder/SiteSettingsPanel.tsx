import { v4 as uuid } from 'uuid';
import { WebsiteModeConfig } from '../../types/homepage';
import SeoSettingsPanel from './SeoSettingsPanel';
import MediaPickerButton from './media/MediaPickerButton';
import StoreLinkPicker from './StoreLinkPicker';
import SidebarSection from './SidebarSection';
import {
  FiChevronDown,
  FiChevronUp,
  FiGlobe,
  FiLink,
  FiPlus,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiType,
} from './builderSidebarIcons';

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
      <SidebarSection title="Brand" icon={<FiType />} description="Name & logo in header">
        <div className="sidebar-field sidebar-field--inline">
          <span className="field-icon" title="Site name">
            <FiType aria-hidden />
          </span>
          <input
            className="panel-input panel-input--grow"
            value={siteSettings.websiteName || ''}
            placeholder="Site name"
            onChange={(e) =>
              onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, websiteName: e.target.value } })
            }
            aria-label="Site name"
          />
        </div>
        <MediaPickerButton
          storeId={storeId}
          assetKey="site-logo"
          label="Logo"
          currentUrl={siteSettings.logoUrl}
          onUrl={(url) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, logoUrl: url } })}
        />
      </SidebarSection>

      <SidebarSection
        title="Menu"
        icon={<FiLink />}
        description="Header navigation links"
        action={
          <button
            type="button"
            className="btn-icon-action"
            title="Add link"
            aria-label="Add link"
            onClick={() =>
              onUpdateWebsiteConfig({
                siteSettings: {
                  ...siteSettings,
                  navItems: [...navItems, { id: uuid(), label: 'Link', href: '/' }],
                },
              })
            }
          >
            <FiPlus aria-hidden />
          </button>
        }
      >
        {navItems.length === 0 ? (
          <p className="sidebar-empty-hint">No links yet</p>
        ) : (
          <div className="sidebar-list">
            {navItems.map((item, index) => (
              <div key={item.id} className="sidebar-list-item sidebar-list-item--compact">
                <div className="sidebar-field sidebar-field--inline">
                  <span className="field-icon" title={`Link ${index + 1}`}>
                    <FiLink aria-hidden />
                  </span>
                  <input
                    className="panel-input panel-input--grow"
                    value={item.label}
                    onChange={(e) => updateNav(websiteConfig, item.id, { label: e.target.value }, onUpdateWebsiteConfig)}
                    placeholder="Label"
                    aria-label={`Link ${index + 1} label`}
                  />
                </div>
                <StoreLinkPicker
                  value={item.href}
                  websiteConfig={websiteConfig}
                  onChange={(href) =>
                    updateNav(websiteConfig, item.id, { href: sanitizeHref(href) }, onUpdateWebsiteConfig)
                  }
                />
                <div className="sidebar-list-item__actions">
                  <button
                    type="button"
                    className="btn-icon-sm"
                    disabled={index === 0}
                    onClick={() => moveNav(websiteConfig, item.id, -1, onUpdateWebsiteConfig)}
                    title="Move up"
                    aria-label="Move up"
                  >
                    <FiChevronUp aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-sm"
                    disabled={index === navItems.length - 1}
                    onClick={() => moveNav(websiteConfig, item.id, 1, onUpdateWebsiteConfig)}
                    title="Move down"
                    aria-label="Move down"
                  >
                    <FiChevronDown aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-sm danger"
                    onClick={() => removeNav(websiteConfig, item.id, onUpdateWebsiteConfig)}
                    title="Remove"
                    aria-label="Remove link"
                  >
                    <FiTrash2 aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SidebarSection>

      <p className="sidebar-tip" title="Click the top bar or footer in the preview to edit them">
        <FiSettings aria-hidden /> Tap announcement bar or footer in preview to edit
      </p>

      <SidebarSection title="SEO" icon={<FiSearch />} description="Search & social preview">
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

