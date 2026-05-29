import FooterSettingsEditor from './FooterSettingsEditor';
import SidebarSection from './SidebarSection';
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
        <button type="button" className="btn-text sidebar-back-btn" onClick={onBack}>
          ← Back
        </button>
        <h3 className="sidebar-panel-toolbar__title">Footer</h3>
      </div>
      <p className="sidebar-top-hint">
        This footer appears at the bottom of every page on your storefront. Changes preview live on the canvas.
      </p>
      <SidebarSection title="Footer settings">
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
