import type { WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';
import ColorPickerField from './ColorPickerField';

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
          <ColorPickerField
            label="Background"
            value={siteSettings.announcementBg || '#111827'}
            defaultValue="#111827"
            onChange={(announcementBg) => patch({ announcementBg })}
          />
          <ColorPickerField
            label="Text"
            value={siteSettings.announcementTextColor || '#ffffff'}
            defaultValue="#ffffff"
            onChange={(announcementTextColor) => patch({ announcementTextColor })}
          />
        </>
      )}
    </>
  );
}
