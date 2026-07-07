import type { SiteAnnouncementRotation, WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';
import {
  DEFAULT_SITE_ANNOUNCEMENT_INTERVAL_SEC,
  DEFAULT_SITE_ANNOUNCEMENT_ROTATION,
  getActiveSiteAnnouncementMessages,
  normalizeSiteAnnouncementSlots,
  patchSiteAnnouncementSlots,
  SITE_ANNOUNCEMENT_ROTATION_OPTIONS,
  SITE_ANNOUNCEMENT_SLOT_COUNT,
} from '../../utils/siteAnnouncementMessages';
import ColorPickerField from './ColorPickerField';
import SidebarDropdownField from './SidebarDropdownField';

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

  const messageSlots = normalizeSiteAnnouncementSlots(siteSettings);
  const activeMessages = getActiveSiteAnnouncementMessages(siteSettings);
  const hasMultipleMessages = activeMessages.length > 1;

  const updateSlot = (slotIndex: number, value: string) => {
    patch(patchSiteAnnouncementSlots(siteSettings, slotIndex, value));
  };

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
        Turn off to remove the bar from every page. Add up to three messages — they rotate one at a time
        when more than one is filled in.
      </p>

      {siteSettings.showAnnouncement && (
        <>
          {Array.from({ length: SITE_ANNOUNCEMENT_SLOT_COUNT }, (_, slotIndex) => (
            <div className="sidebar-field" style={{ marginTop: slotIndex === 0 ? 12 : 10 }} key={slotIndex}>
              <label className="panel-label">Message {slotIndex + 1}</label>
              <input
                className="panel-input"
                value={messageSlots[slotIndex] || ''}
                onChange={(e) => updateSlot(slotIndex, e.target.value)}
                placeholder={
                  slotIndex === 0
                    ? 'e.g. Free shipping on orders over ₹999'
                    : 'Optional — leave blank to skip'
                }
              />
            </div>
          ))}

          {hasMultipleMessages ? (
            <>
              <div className="sidebar-field" style={{ marginTop: 12 }}>
                <label className="panel-label">Message animation</label>
                <SidebarDropdownField
                  ariaLabel="Announcement message animation"
                  value={siteSettings.announcementRotation || DEFAULT_SITE_ANNOUNCEMENT_ROTATION}
                  options={SITE_ANNOUNCEMENT_ROTATION_OPTIONS}
                  onChange={(next) =>
                    patch({ announcementRotation: next as SiteAnnouncementRotation })
                  }
                />
              </div>
              <div className="sidebar-field">
                <label className="panel-label">Change every</label>
                <SidebarDropdownField
                  ariaLabel="Announcement rotation interval"
                  value={String(siteSettings.announcementRotationInterval || DEFAULT_SITE_ANNOUNCEMENT_INTERVAL_SEC)}
                  options={[
                    { value: '3', label: '3 seconds' },
                    { value: '5', label: '5 seconds' },
                    { value: '8', label: '8 seconds' },
                    { value: '12', label: '12 seconds' },
                  ]}
                  onChange={(next) =>
                    patch({ announcementRotationInterval: Number(next) })
                  }
                />
              </div>
            </>
          ) : (
            <p className="panel-hint" style={{ marginTop: 10 }}>
              Fill in a second message to enable rotation and animation options.
            </p>
          )}

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
