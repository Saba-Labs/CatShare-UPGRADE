import HeaderSettingsEditor from './HeaderSettingsEditor';
import SidebarSection from './SidebarSection';
import { FiArrowLeft, FiMenu } from './builderSidebarIcons';
import type { WebsiteModeConfig } from '../../types/homepage';

interface HeaderQuickPanelProps {
  websiteConfig: WebsiteModeConfig;
  storeId: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onBack: () => void;
}

export default function HeaderQuickPanel({
  websiteConfig,
  storeId,
  onUpdateWebsiteConfig,
  onBack,
}: HeaderQuickPanelProps) {
  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-toolbar">
        <button type="button" className="btn-icon-action sidebar-back-btn" onClick={onBack} title="Back" aria-label="Back">
          <FiArrowLeft aria-hidden />
        </button>
        <div className="sidebar-panel-toolbar__head">
          <FiMenu className="sidebar-panel-toolbar__icon" aria-hidden />
          <h3 className="sidebar-panel-toolbar__title">Header</h3>
        </div>
      </div>
      <SidebarSection title="Header" icon={<FiMenu />} description="Logo, menu & layout">
        <HeaderSettingsEditor
          siteSettings={websiteConfig.siteSettings}
          websiteConfig={websiteConfig}
          storeId={storeId}
          onUpdateWebsiteConfig={onUpdateWebsiteConfig}
        />
      </SidebarSection>
    </div>
  );
}
