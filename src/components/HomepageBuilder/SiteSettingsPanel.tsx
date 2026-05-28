import React from 'react';
import { v4 as uuid } from 'uuid';
import { WebsiteModeConfig } from '../../types/homepage';
import SeoSettingsPanel from './SeoSettingsPanel';
import MediaPickerButton from './media/MediaPickerButton';

interface SiteSettingsPanelProps {
  websiteConfig: WebsiteModeConfig;
  storeId: string;
  storeSlug?: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
}

export default function SiteSettingsPanel({ websiteConfig, storeId, storeSlug, onUpdateWebsiteConfig }: SiteSettingsPanelProps) {
  const { siteSettings } = websiteConfig;

  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-header">
        <h3>Site</h3>
      </div>
      <div className="sidebar-panel-section">
        <label className="panel-label">Site name</label>
        <input
          className="panel-input"
          value={siteSettings.websiteName || ''}
          onChange={(e) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, websiteName: e.target.value } })}
        />
      </div>
      <div className="sidebar-panel-section">
        <label className="panel-label">Logo</label>
        <MediaPickerButton
          storeId={storeId}
          assetKey="site-logo"
          label="Upload logo"
          currentUrl={siteSettings.logoUrl}
          onUrl={(url) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, logoUrl: url } })}
        />
      </div>
      <div className="sidebar-panel-section panel-checkbox">
        <input
          type="checkbox"
          id="show-announcement"
          checked={!!siteSettings.showAnnouncement}
          onChange={(e) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, showAnnouncement: e.target.checked } })}
        />
        <label htmlFor="show-announcement">Show announcement bar</label>
      </div>
      {siteSettings.showAnnouncement && (
        <div className="sidebar-panel-section">
          <label className="panel-label">Announcement</label>
          <input
            className="panel-input"
            value={siteSettings.announcementText || ''}
            onChange={(e) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, announcementText: e.target.value } })}
          />
        </div>
      )}

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Menu</h3>
        <button
          type="button"
          className="btn-text"
          onClick={() =>
            onUpdateWebsiteConfig({
              siteSettings: {
                ...siteSettings,
                navItems: [...(siteSettings.navItems || []), { id: uuid(), label: 'Link', href: '/' }],
              },
            })
          }
        >
          + Add
        </button>
      </div>
      <div className="nav-items-list">
        {(siteSettings.navItems || []).map((item, index) => (
          <div key={item.id} className="nav-item-row">
            <input
              className="panel-input"
              value={item.label}
              onChange={(e) => updateNav(websiteConfig, item.id, { label: e.target.value }, onUpdateWebsiteConfig)}
              placeholder="Label"
            />
            <input
              className="panel-input"
              value={item.href}
              onChange={(e) => updateNav(websiteConfig, item.id, { href: sanitizeHref(e.target.value) }, onUpdateWebsiteConfig)}
              placeholder="/page"
            />
            <div className="nav-item-row-actions">
              <button type="button" className="btn-icon-sm" disabled={index === 0} onClick={() => moveNav(websiteConfig, item.id, -1, onUpdateWebsiteConfig)}>↑</button>
              <button type="button" className="btn-icon-sm" disabled={index === (siteSettings.navItems?.length || 0) - 1} onClick={() => moveNav(websiteConfig, item.id, 1, onUpdateWebsiteConfig)}>↓</button>
              <button type="button" className="btn-icon-sm danger" onClick={() => removeNav(websiteConfig, item.id, onUpdateWebsiteConfig)}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-section">
        <label className="panel-label">Footer background</label>
        <input
          type="color"
          className="panel-input"
          value={siteSettings.footerBg || '#0f172a'}
          onChange={(e) => onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, footerBg: e.target.value } })}
        />
      </div>

      <SeoSettingsPanel
        websiteConfig={websiteConfig}
        storeId={storeId}
        storeSlug={storeSlug}
        onUpdateWebsiteConfig={onUpdateWebsiteConfig}
      />
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
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) => (item.id === id ? { ...item, ...updates } : item)),
    },
  });
}

function moveNav(websiteConfig: WebsiteModeConfig, id: string, dir: -1 | 1, onUpdate: (u: Partial<WebsiteModeConfig>) => void) {
  const items = [...(websiteConfig.siteSettings.navItems || [])];
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const next = idx + dir;
  if (next < 0 || next >= items.length) return;
  const [moved] = items.splice(idx, 1);
  items.splice(next, 0, moved);
  onUpdate({ siteSettings: { ...websiteConfig.siteSettings, navItems: items } });
}

function removeNav(websiteConfig: WebsiteModeConfig, id: string, onUpdate: (u: Partial<WebsiteModeConfig>) => void) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).filter((item) => item.id !== id),
    },
  });
}
