import React from 'react';
import ComponentPalette from './ComponentPalette';
import PagesPanel from './PagesPanel';
import ThemePanel from './ThemePanel';
import SiteSettingsPanel from './SiteSettingsPanel';
import SectionQuickPanel from './SectionQuickPanel';
import FooterQuickPanel from './FooterQuickPanel';
import AnnouncementQuickPanel from './AnnouncementQuickPanel';
import TemplateGallery from './TemplateGallery';
import { SITE_ANNOUNCEMENT_SELECTION_ID, SITE_FOOTER_SELECTION_ID } from '../../config/homepageBuilderConfig';
import type { WebsiteTemplateId } from '../../config/websiteTemplates';
import { HomepageSection, HomepageSectionType, ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { BlockPresetId } from '../../config/blockPresets';

export type SidebarTab = 'insert' | 'templates' | 'pages' | 'theme' | 'site';

interface BuilderSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  selectedSectionId: string | null;
  sections: (HomepageSection & { id: string })[];
  theme: ThemeSettings;
  websiteConfig: WebsiteModeConfig;
  editingPageId: string;
  storeId: string;
  storeSlug?: string;
  onAddSection: (type: HomepageSectionType) => void;
  onAddPreset: (presetId: BlockPresetId) => void;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onSelectEditingPage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onClearSectionSelection: () => void;
  onApplyTemplate?: (id: WebsiteTemplateId) => void;
}

const TABS: Array<{ id: SidebarTab; label: string }> = [
  { id: 'insert', label: 'Insert' },
  { id: 'templates', label: 'Templates' },
  { id: 'pages', label: 'Pages' },
  { id: 'theme', label: 'Theme' },
  { id: 'site', label: 'Site' },
];

export default function BuilderSidebar({
  activeTab,
  onTabChange,
  selectedSectionId,
  sections,
  theme,
  websiteConfig,
  editingPageId,
  storeId,
  storeSlug,
  onAddSection,
  onAddPreset,
  onUpdateSection,
  onUpdateTheme,
  onUpdateWebsiteConfig,
  onSelectEditingPage,
  onAddPage,
  onRemovePage,
  onClearSectionSelection,
  onApplyTemplate,
}: BuilderSidebarProps) {
  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const isSiteFooterSelected = selectedSectionId === SITE_FOOTER_SELECTION_ID;
  const isSiteAnnouncementSelected = selectedSectionId === SITE_ANNOUNCEMENT_SELECTION_ID;

  return (
    <aside className="builder-sidebar">
      <div className="builder-sidebar-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`builder-sidebar-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="builder-sidebar-body">
        {selectedSection ? (
          <SectionQuickPanel
            section={selectedSection}
            storeId={storeId}
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            onUpdate={(updates) => onUpdateSection(selectedSection.id, updates)}
            onBack={onClearSectionSelection}
          />
        ) : isSiteAnnouncementSelected ? (
          <AnnouncementQuickPanel
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            onBack={onClearSectionSelection}
          />
        ) : isSiteFooterSelected ? (
          <FooterQuickPanel
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            onBack={onClearSectionSelection}
          />
        ) : (
          <>
            {activeTab === 'insert' && <ComponentPalette onAddSection={onAddSection} onAddPreset={onAddPreset} />}
            {activeTab === 'templates' && onApplyTemplate && (
              <>
                {editingPageId !== 'home' && (
                  <p className="sidebar-top-hint" style={{ padding: '0 12px 8px' }}>
                    Applying a template updates your whole site (you will return to Home).
                  </p>
                )}
                <TemplateGallery variant="compact" onApply={onApplyTemplate} />
              </>
            )}
            {activeTab === 'pages' && (
              <PagesPanel
                websiteConfig={websiteConfig}
                editingPageId={editingPageId}
                onUpdateWebsiteConfig={onUpdateWebsiteConfig}
                onSelectEditingPage={onSelectEditingPage}
                onAddPage={onAddPage}
                onRemovePage={onRemovePage}
              />
            )}
            {activeTab === 'theme' && (
              <ThemePanel theme={theme} websiteConfig={websiteConfig} onUpdateTheme={onUpdateTheme} onUpdateWebsiteConfig={onUpdateWebsiteConfig} />
            )}
            {activeTab === 'site' && (
              <SiteSettingsPanel
                websiteConfig={websiteConfig}
                storeId={storeId}
                storeSlug={storeSlug}
                onUpdateWebsiteConfig={onUpdateWebsiteConfig}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
