import { WebsiteModeConfig } from '../../types/homepage';
import SeoSettingsPanel from './SeoSettingsPanel';
import SidebarSection from './SidebarSection';
import { FiSearch, FiSettings } from './builderSidebarIcons';

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
  return (
    <div className="sidebar-panel">
      <p className="sidebar-tip" title="Click regions in the preview to edit them">
        <FiSettings aria-hidden /> Click the <strong>header</strong>, <strong>announcement</strong>, or{' '}
        <strong>footer</strong> in the preview to edit layout, menu, and colors.
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
