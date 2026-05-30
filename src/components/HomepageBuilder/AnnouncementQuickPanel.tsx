import AnnouncementSettingsEditor from './AnnouncementSettingsEditor';
import SidebarSection from './SidebarSection';
import { FiArrowLeft, FiBell } from './builderSidebarIcons';
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
        <button type="button" className="btn-icon-action sidebar-back-btn" onClick={onBack} title="Back" aria-label="Back">
          <FiArrowLeft aria-hidden />
        </button>
        <div className="sidebar-panel-toolbar__head">
          <FiBell className="sidebar-panel-toolbar__icon" aria-hidden />
          <h3 className="sidebar-panel-toolbar__title">Banner</h3>
        </div>
      </div>
      <SidebarSection title="Banner" icon={<FiBell />} description="Top announcement bar">
        <AnnouncementSettingsEditor
          siteSettings={websiteConfig.siteSettings}
          onUpdateWebsiteConfig={onUpdateWebsiteConfig}
        />
      </SidebarSection>
    </div>
  );
}
