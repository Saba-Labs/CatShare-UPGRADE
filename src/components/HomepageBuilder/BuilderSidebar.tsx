import React from 'react';
import ComponentPalette from './ComponentPalette';
import PagesPanel from './PagesPanel';
import ThemePanel from './ThemePanel';
import SiteSettingsPanel from './SiteSettingsPanel';
import SectionQuickPanel from './SectionQuickPanel';
import { HomepageSection, HomepageSectionType, ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { BlockPresetId } from '../../config/blockPresets';

export type SidebarTab = 'insert' | 'pages' | 'theme' | 'site';

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
  onClearSectionSelection: () => void;
}

const TABS: Array<{ id: SidebarTab; label: string }> = [
  { id: 'insert', label: 'Insert' },
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
  onClearSectionSelection,
}: BuilderSidebarProps) {
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

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
            onUpdate={(updates) => onUpdateSection(selectedSection.id, updates)}
            onBack={onClearSectionSelection}
          />
        ) : (
          <>
            {activeTab === 'insert' && <ComponentPalette onAddSection={onAddSection} onAddPreset={onAddPreset} />}
            {activeTab === 'pages' && (
              <PagesPanel
                websiteConfig={websiteConfig}
                editingPageId={editingPageId}
                onUpdateWebsiteConfig={onUpdateWebsiteConfig}
                onSelectEditingPage={onSelectEditingPage}
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
