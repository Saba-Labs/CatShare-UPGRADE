import AnnouncementSettingsEditor from './AnnouncementSettingsEditor';
import SidebarSection from './SidebarSection';
import type { WebsiteModeConfig } from '../../types/homepage';

interface AnnouncementQuickPanelProps {
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onBack: () => void;
}

export default function AnnouncementQuickPanel({
  websiteConfig,
  onUpdateWebsiteConfig,
  onBack,
}: AnnouncementQuickPanelProps) {
  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-toolbar">
        <button type="button" className="btn-text sidebar-back-btn" onClick={onBack}>
          ← Back
        </button>
        <h3 className="sidebar-panel-toolbar__title">Announcement bar</h3>
      </div>
      <p className="sidebar-top-hint">
        This slim banner appears above your site header on every page. It is not a page block — templates turn it on
        automatically.
      </p>
      <SidebarSection title="Announcement settings">
        <AnnouncementSettingsEditor
          siteSettings={websiteConfig.siteSettings}
          onUpdateWebsiteConfig={onUpdateWebsiteConfig}
        />
      </SidebarSection>
    </div>
  );
}
