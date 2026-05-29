import type { WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';

interface AnnouncementSettingsEditorProps {
  siteSettings: WebsiteSiteSettings;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
}

export default function AnnouncementSettingsEditor({
  siteSettings,
  onUpdateWebsiteConfig,
}: AnnouncementSettingsEditorProps) {
  const patch = (updates: Partial<WebsiteSiteSettings>) =>
    onUpdateWebsiteConfig({ siteSettings: { ...siteSettings, ...updates } });

  return (
    <>
      <label className="sidebar-toggle">
        <input
          type="checkbox"
          checked={!!siteSettings.showAnnouncement}
          onChange={(e) => patch({ showAnnouncement: e.target.checked })}
        />
        <span>Show announcement bar</span>
      </label>
      <p className="panel-hint" style={{ marginTop: 8 }}>
        Turn off to remove the bar from every page. Templates 1 and 2 enable this by default.
      </p>

      {siteSettings.showAnnouncement && (
        <>
          <div className="sidebar-field" style={{ marginTop: 12 }}>
            <label className="panel-label">Message</label>
            <input
              className="panel-input"
              value={siteSettings.announcementText || ''}
              onChange={(e) => patch({ announcementText: e.target.value })}
              placeholder="e.g. Free shipping on orders over ₹999"
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Background color</label>
            <input
              type="color"
              className="panel-input"
              value={siteSettings.announcementBg || '#111827'}
              onChange={(e) => patch({ announcementBg: e.target.value })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Text color</label>
            <input
              type="color"
              className="panel-input"
              value={siteSettings.announcementTextColor || '#ffffff'}
              onChange={(e) => patch({ announcementTextColor: e.target.value })}
            />
          </div>
        </>
      )}
    </>
  );
}
