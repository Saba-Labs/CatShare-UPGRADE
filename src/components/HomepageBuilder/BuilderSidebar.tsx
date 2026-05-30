import React from 'react';
import ComponentPalette from './ComponentPalette';
import PagesPanel from './PagesPanel';
import ThemePanel from './ThemePanel';
import SiteSettingsPanel from './SiteSettingsPanel';
import SectionQuickPanel from './SectionQuickPanel';
import FooterQuickPanel from './FooterQuickPanel';
import AnnouncementQuickPanel from './AnnouncementQuickPanel';
import TemplateGallery from './TemplateGallery';
import MediaLibraryPanel from './media/MediaLibraryPanel';
import { SIDEBAR_TAB_META } from './builderSidebarIcons';
import { SITE_ANNOUNCEMENT_SELECTION_ID, SITE_FOOTER_SELECTION_ID } from '../../config/homepageBuilderConfig';
import type { WebsiteTemplateId } from '../../config/websiteTemplates';
import { HomepageSection, HomepageSectionType, ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { BlockPresetId } from '../../config/blockPresets';

export type SidebarTab = 'insert' | 'templates' | 'pages' | 'theme' | 'site' | 'photos';

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

const TAB_ORDER: SidebarTab[] = ['insert', 'templates', 'pages', 'photos', 'theme', 'site'];

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

  const activeMeta = SIDEBAR_TAB_META[activeTab];
  const ActiveTabIcon = activeMeta.Icon;

  return (
    <aside className="builder-sidebar builder-sidebar--rail">
      <nav className="builder-sidebar-rail" aria-label="Editor panels">
        {TAB_ORDER.map((id) => {
          const { label, hint, Icon } = SIDEBAR_TAB_META[id];
          return (
            <button
              key={id}
              type="button"
              className={`builder-sidebar-tab builder-sidebar-tab--rail${activeTab === id ? ' active' : ''}`}
              onClick={() => onTabChange(id)}
              aria-label={`${label}. ${hint}`}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <Icon className="builder-sidebar-tab__icon" aria-hidden />
              <span className="builder-sidebar-tab__label">{label}</span>
              <span className="builder-sidebar-tab__tooltip" role="tooltip">
                <span className="builder-sidebar-tab__tooltip-title">{label}</span>
                <span className="builder-sidebar-tab__tooltip-hint">{hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="builder-sidebar-main">
        {!selectedSection && !isSiteFooterSelected && !isSiteAnnouncementSelected ? (
          <div className="builder-sidebar-main__head">
            <ActiveTabIcon className="builder-sidebar-main__head-icon" aria-hidden />
            <span className="builder-sidebar-main__head-title">{activeMeta.label}</span>
          </div>
        ) : null}

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
              <TemplateGallery variant="compact" onApply={onApplyTemplate} />
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
            {activeTab === 'photos' && <MediaLibraryPanel storeId={storeId} />}
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
      </div>
    </aside>
  );
}
