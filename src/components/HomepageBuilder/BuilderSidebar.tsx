import React, { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import ComponentPalette from './ComponentPalette';
import PagesPanel from './PagesPanel';
import ThemePanel from './ThemePanel';
import SiteSettingsPanel from './SiteSettingsPanel';
import SectionQuickPanel from './SectionQuickPanel';
import FooterQuickPanel from './FooterQuickPanel';
import HeaderQuickPanel from './HeaderQuickPanel';
import AnnouncementQuickPanel from './AnnouncementQuickPanel';
import TemplateGallery from './TemplateGallery';
import MediaLibraryPanel from './media/MediaLibraryPanel';
import { SIDEBAR_TAB_META } from './builderSidebarIcons';
import {
  SITE_ANNOUNCEMENT_SELECTION_ID,
  SITE_FOOTER_SELECTION_ID,
  SITE_HEADER_SELECTION_ID,
} from '../../config/homepageBuilderConfig';
import type { WebsiteTemplateId } from '../../config/websiteTemplates';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type {
  FreeformElementType,
  HomepageSection,
  HomepageSectionType,
  ThemeSettings,
  WebsiteModeConfig,
} from '../../types/homepage';
import ProductTemplateQuickPanel from './ProductTemplateQuickPanel';
import CollectionTemplateQuickPanel from './CollectionTemplateQuickPanel';
import { BlockPresetId } from '../../config/blockPresets';
import RestoreThemeDialog from './RestoreThemeDialog';

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
  onAddFreeformElement?: (type: FreeformElementType) => void;
  selectedFreeformElementId?: string | null;
  onSelectFreeformElement?: (id: string | null) => void;
  onAddPreset: (presetId: BlockPresetId) => void;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onSelectEditingPage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onClearSectionSelection: () => void;
  onAddSiteAnnouncement?: () => void;
  onApplyTemplate?: (id: WebsiteTemplateId) => void;
  onCookTheme?: () => void;
  onStartBlank?: () => void;
  onRestoreOriginal?: () => void;
  restoreOriginalMessage?: string;
  themeHubMode?: boolean;
  previewProduct?: ProductWithCatalogueData | null;
  onCloseProductPreview?: () => void;
  previewCategory?: { id: string; label: string } | null;
  onCloseCategoryPreview?: () => void;
  onOpenShopCatalog?: () => void;
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
  onAddFreeformElement,
  selectedFreeformElementId = null,
  onSelectFreeformElement,
  onAddPreset,
  onUpdateSection,
  onUpdateTheme,
  onUpdateWebsiteConfig,
  onSelectEditingPage,
  onAddPage,
  onRemovePage,
  onClearSectionSelection,
  onAddSiteAnnouncement,
  onApplyTemplate,
  onCookTheme,
  onStartBlank,
  onRestoreOriginal,
  restoreOriginalMessage = 'Remove the current theme and restore your previous layout? Unsaved changes will be lost.',
  themeHubMode = false,
  previewProduct = null,
  onCloseProductPreview,
  previewCategory = null,
  onCloseCategoryPreview,
  onOpenShopCatalog,
}: BuilderSidebarProps) {
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const isSiteFooterSelected = selectedSectionId === SITE_FOOTER_SELECTION_ID;
  const isSiteAnnouncementSelected = selectedSectionId === SITE_ANNOUNCEMENT_SELECTION_ID;
  const isSiteHeaderSelected = selectedSectionId === SITE_HEADER_SELECTION_ID;

  const activeMeta = SIDEBAR_TAB_META[activeTab];
  const ActiveTabIcon = activeMeta.Icon;

  return (
    <aside className={`builder-sidebar builder-sidebar--rail${themeHubMode ? ' builder-sidebar--theme-hub' : ''}`}>
      <nav className="builder-sidebar-rail" aria-label="Editor panels">
        <div className="builder-sidebar-rail__tabs">
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
        </div>

        {onRestoreOriginal ? (
          <button
            type="button"
            className="builder-sidebar-rail-restore"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setRestoreDialogOpen(true);
            }}
            aria-label="Remove theme and restore original layout"
            title="Remove theme · restore original"
          >
            <FiTrash2 className="builder-sidebar-rail-restore__icon" aria-hidden />
          </button>
        ) : null}
      </nav>

      <RestoreThemeDialog
        open={restoreDialogOpen}
        message={restoreOriginalMessage}
        onCancel={() => setRestoreDialogOpen(false)}
        onConfirm={() => {
          setRestoreDialogOpen(false);
          onRestoreOriginal?.();
        }}
      />

      <div className={`builder-sidebar-main${themeHubMode ? ' builder-sidebar-main--collapsed' : ''}`}>
        {!previewProduct && !previewCategory && !selectedSection && !isSiteFooterSelected && !isSiteAnnouncementSelected && !isSiteHeaderSelected ? (
          <div className="builder-sidebar-main__head">
            <ActiveTabIcon className="builder-sidebar-main__head-icon" aria-hidden />
            <span className="builder-sidebar-main__head-title">{activeMeta.label}</span>
          </div>
        ) : null}

      <div className="builder-sidebar-body">
        {previewProduct &&
        !previewCategory &&
        !isSiteFooterSelected &&
        !isSiteHeaderSelected &&
        !isSiteAnnouncementSelected &&
        onCloseProductPreview ? (
          <ProductTemplateQuickPanel
            productName={previewProduct.name}
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            onBack={onCloseProductPreview}
          />
        ) : previewCategory &&
          !previewProduct &&
          !isSiteFooterSelected &&
          !isSiteHeaderSelected &&
          !isSiteAnnouncementSelected &&
          onCloseCategoryPreview ? (
          <CollectionTemplateQuickPanel
            categoryLabel={previewCategory.label}
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            onBack={onCloseCategoryPreview}
          />
        ) : selectedSection ? (
          <SectionQuickPanel
            section={selectedSection}
            storeId={storeId}
            websiteConfig={websiteConfig}
            selectedFreeformElementId={selectedFreeformElementId}
            onSelectFreeformElement={onSelectFreeformElement}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            onUpdate={(updates) => onUpdateSection(selectedSection.id, updates)}
            onBack={onClearSectionSelection}
          />
        ) : isSiteHeaderSelected ? (
          <HeaderQuickPanel
            websiteConfig={websiteConfig}
            storeId={storeId}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
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
            {activeTab === 'insert' && (
              <ComponentPalette
                onAddSection={onAddSection}
                onAddFreeformElement={onAddFreeformElement}
                onAddPreset={onAddPreset}
                siteAnnouncementEnabled={!!websiteConfig.siteSettings.showAnnouncement}
                onAddSiteAnnouncement={onAddSiteAnnouncement}
              />
            )}
            {activeTab === 'templates' && onApplyTemplate && (
              <TemplateGallery
                variant="compact"
                onApply={onApplyTemplate}
                onCookTheme={onCookTheme}
                onStartBlank={onStartBlank}
              />
            )}
            {activeTab === 'pages' && (
              <PagesPanel
                websiteConfig={websiteConfig}
                editingPageId={editingPageId}
                previewCategoryId={previewCategory?.id ?? null}
                onUpdateWebsiteConfig={onUpdateWebsiteConfig}
                onSelectEditingPage={onSelectEditingPage}
                onAddPage={onAddPage}
                onRemovePage={onRemovePage}
                onOpenShopCatalog={onOpenShopCatalog}
              />
            )}
            {activeTab === 'photos' && <MediaLibraryPanel storeId={storeId} />}
            {activeTab === 'theme' && (
              <ThemePanel theme={theme} onUpdateTheme={onUpdateTheme} />
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
