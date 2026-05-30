import FooterSettingsEditor from './FooterSettingsEditor';
import SidebarSection from './SidebarSection';
import { FiAlignLeft, FiArrowLeft } from './builderSidebarIcons';
import type { WebsiteModeConfig } from '../../types/homepage';

interface FooterQuickPanelProps {
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onBack: () => void;
}

export default function FooterQuickPanel({
  websiteConfig,
  onUpdateWebsiteConfig,
  onBack,
}: FooterQuickPanelProps) {
  const { siteSettings } = websiteConfig;

  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-toolbar">
        <button type="button" className="btn-icon-action sidebar-back-btn" onClick={onBack} title="Back" aria-label="Back">
          <FiArrowLeft aria-hidden />
        </button>
        <div className="sidebar-panel-toolbar__head">
          <FiAlignLeft className="sidebar-panel-toolbar__icon" aria-hidden />
          <h3 className="sidebar-panel-toolbar__title">Footer</h3>
        </div>
      </div>
      <SidebarSection title="Footer" icon={<FiAlignLeft />} description="Site-wide footer">
        <FooterSettingsEditor
          siteSettings={siteSettings}
          websiteConfig={websiteConfig}
          onUpdateWebsiteConfig={onUpdateWebsiteConfig}
          embedded
        />
      </SidebarSection>
    </div>
  );
}
