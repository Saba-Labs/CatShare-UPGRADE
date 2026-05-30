import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useHomepageBuilder } from '../../hooks/useHomepageBuilder';
import type { FreeformElementType, FreeformSection } from '../../types/homepage';
import { createFreeformElement } from '../../utils/freeformElements';
import { useHomepageAutosave } from '../../hooks/useHomepageAutosave';
import { useResponsiveBuilder } from '../../hooks/useResponsiveBuilder';
import {
  getHomepageConfig,
  createHomepageConfig,
  ensureHomepageConfig,
  updateHomepageLayout,
  publishHomepageConfig,
  USE_LOCAL_HOMEPAGE_STORE,
} from '../../services/homepageService';
import { isPersistedHomepageConfigId } from '../../utils/homepageConfigId';
import { buildStorefrontUrl } from '../../utils/storefrontDomain';
import { homepageLayoutsEqual } from '../../utils/homepagePublish';
import {
  createEmptyHomepageLayout,
  createDefaultWebsiteModeConfig,
  normalizeHomepageLayoutForWebsiteMode,
} from '../../config/homepageBuilderConfig';
import { HomepageConfig, ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { getWebsiteTemplate, type WebsiteTemplateId } from '../../config/websiteTemplates';
import { getSiteTheme, syncSiteThemeAcrossPages } from '../../utils/websiteSiteTheme';
import { isOfflineBuilderMode } from '../../config/offlineBuilder';
import BuilderMobileGate from './BuilderMobileGate';
import BuilderToolbar, { ViewportSize } from './BuilderToolbar';
import BuilderSidebar, { SidebarTab } from './BuilderSidebar';
import BuilderDndProvider from './dnd/BuilderDndProvider';
import GridCanvas from './GridCanvas';
import PreviewPane from './PreviewPane';
import { BuilderMediaProvider } from './media/BuilderMediaContext';
import { BuilderCatalogueProvider } from './catalogue/BuilderCatalogueContext';
import './HomepageBuilder.css';

interface HomepageBuilderProps {
  storeId: string;
  storeSlug?: string;
  sellerUserId?: string;
  catalogues?: import('../../config/catalogueConfig').Catalogue[];
  catalogueId?: string;
  currencyCode?: string;
  storeWhatsapp?: string | null;
  onClose?: () => void;
}

export default function HomepageBuilder({
  storeId,
  storeSlug,
  sellerUserId,
  catalogues,
  catalogueId,
  currencyCode,
  storeWhatsapp,
  onClose,
}: HomepageBuilderProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { state, actions } = useHomepageBuilder();
  const responsiveState = useResponsiveBuilder();
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('insert');
  const [editingPageId, setEditingPageId] = useState('home');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedFreeformElementId, setSelectedFreeformElementId] = useState<string | null>(null);

  const configPersisted = isPersistedHomepageConfigId(config?.id);

  useHomepageAutosave({
    configId: config?.id || '',
    layout: state.layout,
    isDirty: state.isDirty,
    enabled: configPersisted,
    debounceMs: 2000,
    onSaveComplete: () => {
      actions.markSaved();
      showToast('Changes saved', 'success');
    },
    onSaveError: (error) => {
      actions.setError(error.message);
      showToast(`Failed to save: ${error.message}`, 'error');
    },
  });

  useEffect(() => {
    const loadConfig = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Config loading timed out after 10 seconds')), 10000)
      );

      try {
        setIsLoading(true);
        let existingConfig: any = null;
        try {
          existingConfig = await Promise.race([getHomepageConfig(storeId), timeoutPromise as Promise<any>]);
        } catch {
          /* create fallback below */
        }

        if (!existingConfig) {
          const emptyLayout = createEmptyHomepageLayout();
          try {
            existingConfig = await Promise.race([createHomepageConfig(storeId, emptyLayout), timeoutPromise as Promise<any>]);
          } catch (createErr) {
            const retryGet = await getHomepageConfig(storeId).catch(() => null);
            if (retryGet) {
              existingConfig = retryGet;
            } else {
              throw createErr;
            }
          }
        }

        const normalizedLayout = normalizeHomepageLayoutForWebsiteMode(existingConfig.layout);
        setConfig({ ...existingConfig, layout: normalizedLayout });
        actions.setLayout(normalizedLayout);
        setEditingPageId('home');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load homepage config';
        actions.setError(msg);
        showToast(msg, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [storeId, showToast]);

  const buildDraftLayout = () => {
    const snapshotWebsiteConfig = snapshotCurrentPageIntoWebsiteConfig(
      state.layout.websiteConfig || createDefaultWebsiteModeConfig(),
      state.layout,
      editingPageId
    );
    return {
      ...state.layout,
      websiteConfig: snapshotWebsiteConfig,
    };
  };

  const resolvePersistedConfig = async () => {
    const draftLayout = buildDraftLayout();
    const persisted = await ensureHomepageConfig(storeId, config, draftLayout);
    setConfig(persisted);
    return persisted;
  };

  const handleSave = async () => {
    try {
      const persisted = await resolvePersistedConfig();
      const updated = await updateHomepageLayout(persisted.id, buildDraftLayout());
      setConfig(updated);
      actions.markSaved();
      showToast('Draft saved', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      actions.setError(msg);
      showToast(msg, 'error');
    }
  };

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      const persisted = await resolvePersistedConfig();
      const draftLayout = buildDraftLayout();
      await updateHomepageLayout(persisted.id, draftLayout);
      const published = await publishHomepageConfig(persisted.id, draftLayout, {
        updatedBy: user?.uid,
      });
      setConfig(published);
      actions.setLayout(draftLayout);
      actions.markSaved();
      showToast('Site published — customers will see your latest changes', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to publish';
      actions.setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleViewLive = () => {
    if (!storeSlug) {
      showToast('Store link unavailable', 'warning');
      return;
    }
    window.open(buildStorefrontUrl(storeSlug), '_blank', 'noopener,noreferrer');
  };

  const draftLayoutForCompare = useMemo(() => buildDraftLayout(), [state.layout, editingPageId]);

  const hasUnpublishedChanges = useMemo(
    () => !homepageLayoutsEqual(draftLayoutForCompare, config?.publishedLayout),
    [draftLayoutForCompare, config?.publishedLayout]
  );

  const isLive = !!config?.publishedLayout && !!config?.publishedAt;

  const updateWebsiteConfig = (updates: Partial<WebsiteModeConfig>) => {
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const nextPages = updates.pages
      ? {
          ...current.pages,
          ...updates.pages,
          ...(updates.pages.custom !== undefined ? { custom: updates.pages.custom } : {}),
        }
      : current.pages;
    const merged: WebsiteModeConfig = {
      ...current,
      ...updates,
      siteSettings: { ...current.siteSettings, ...(updates.siteSettings || {}) },
      templates: { ...current.templates, ...(updates.templates || {}) },
      pages: nextPages,
    };
    actions.updateWebsiteConfig(syncSiteThemeAcrossPages(merged));
  };

  const handleUpdateTheme = (updates: Partial<ThemeSettings>) => {
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const nextTheme = { ...getSiteTheme(current), ...updates };
    const snapshotted = snapshotCurrentPageIntoWebsiteConfig(
      current,
      { sections: state.layout.sections, theme: nextTheme },
      editingPageId
    );
    const synced = syncSiteThemeAcrossPages(snapshotted);
    actions.switchEditingPage({
      websiteConfig: synced,
      sections: (state.layout.sections || []) as typeof state.layout.sections,
      theme: nextTheme,
    });
  };

  const handleSelectEditingPage = (nextPageId: string) => {
    if (nextPageId === editingPageId) return;
    const currentWebsiteConfig = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const withSnapshot = snapshotCurrentPageIntoWebsiteConfig(currentWebsiteConfig, state.layout, editingPageId);
    const nextPageLayout = getPageLayout(withSnapshot, nextPageId);
    const siteTheme = getSiteTheme(withSnapshot);
    actions.switchEditingPage({
      websiteConfig: withSnapshot,
      sections: (nextPageLayout.sections || []) as typeof state.layout.sections,
      theme: siteTheme,
    });
    actions.selectSection(null);
    setEditingPageId(nextPageId);
  };

  const handleAddPage = () => {
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const customPages = current.pages.custom || [];
    const nextIndex = customPages.length + 1;
    const pageId = uuid();
    const title = `Page ${nextIndex}`;
    const slug = `page-${nextIndex}`;
    const siteTheme = getSiteTheme(current);
    const newPage = {
      id: pageId,
      title,
      slug,
      layout: { sections: [], theme: { ...siteTheme } },
    };
    const withSnapshot = snapshotCurrentPageIntoWebsiteConfig(current, state.layout, editingPageId);
    const mergedConfig = syncSiteThemeAcrossPages({
      ...withSnapshot,
      pages: {
        ...withSnapshot.pages,
        custom: [...(withSnapshot.pages.custom || []), newPage],
      },
      siteSettings: {
        ...withSnapshot.siteSettings,
        navItems: [
          ...withSnapshot.siteSettings.navItems,
          { id: uuid(), label: title, href: `/${slug}` },
        ],
      },
    });
    actions.switchEditingPage({
      websiteConfig: mergedConfig,
      sections: [],
      theme: siteTheme,
    });
    actions.selectSection(null);
    setEditingPageId(pageId);
  };

  const handleRemovePage = (pageId: string) => {
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const page = (current.pages.custom || []).find((p) => p.id === pageId);
    if (!page) return;
    const withSnapshot = snapshotCurrentPageIntoWebsiteConfig(current, state.layout, editingPageId);
    const mergedConfig: WebsiteModeConfig = {
      ...withSnapshot,
      pages: {
        ...withSnapshot.pages,
        custom: (withSnapshot.pages.custom || []).filter((p) => p.id !== pageId),
      },
      siteSettings: {
        ...withSnapshot.siteSettings,
        navItems: withSnapshot.siteSettings.navItems.filter((item) => item.href !== `/${page.slug}`),
      },
    };
    if (editingPageId === pageId) {
      const homeLayout = mergedConfig.pages.home;
      actions.switchEditingPage({
        websiteConfig: mergedConfig,
        sections: (homeLayout.sections || []) as typeof state.layout.sections,
        theme: homeLayout.theme || state.layout.theme,
      });
      actions.selectSection(null);
      setEditingPageId('home');
    } else {
      actions.updateWebsiteConfig(mergedConfig);
    }
  };

  const handleApplyTemplate = (templateId: WebsiteTemplateId) => {
    const tpl = getWebsiteTemplate(templateId);
    if (!tpl) return;
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const withSnapshot = snapshotCurrentPageIntoWebsiteConfig(current, state.layout, editingPageId);
    const homeHasContent = (withSnapshot.pages.home.sections || []).length > 0;
    if (homeHasContent) {
      const ok = window.confirm(
        `Apply the "${tpl.name}" template to your whole site? Your home page content will be replaced. Custom pages keep their sections but use the same colors, footer, and shop styling.`
      );
      if (!ok) return;
    }

    const built = tpl.build();
    const siteTheme = built.pages.home.theme;
    const customPages = (withSnapshot.pages.custom || []).map((page) => ({
      ...page,
      layout: {
        ...page.layout,
        theme: siteTheme ? { ...siteTheme } : page.layout.theme,
      },
    }));
    const customNavItems = customPages.map((page) => ({
      id: uuid(),
      label: page.title,
      href: `/${page.slug}`,
    }));
    const mergedConfig: WebsiteModeConfig = {
      ...built,
      activeTemplateId: templateId,
      siteSettings: {
        ...built.siteSettings,
        navItems: [...built.siteSettings.navItems, ...customNavItems],
      },
      pages: {
        home: built.pages.home,
        custom: customPages,
      },
    };

    actions.switchEditingPage({
      websiteConfig: mergedConfig,
      sections: (built.pages.home.sections || []) as typeof state.layout.sections,
      theme: built.pages.home.theme || state.layout.theme,
    });
    actions.selectSection(null);
    setEditingPageId('home');
    setSidebarTab('insert');
    showToast(`Applied ${tpl.name} across your site`, 'success');
  };

  const handleStartBlank = () => {
    setSidebarTab('insert');
  };

  const handleSelectSection = (id: string | null) => {
    actions.selectSection(id);
    setSelectedFreeformElementId(null);
  };

  const addFreeformElement = useCallback(
    (elementType: FreeformElementType) => {
      const selected = state.layout.sections.find((s) => s.id === state.selectedSectionId);
      if (selected?.type === 'freeform') {
        const section = selected as FreeformSection & { id: string };
        const elements = section.content.elements || [];
        const maxZ = elements.reduce((m, el) => Math.max(m, el.layout.zIndex ?? 0), 0);
        const el = createFreeformElement(elementType, maxZ + 1);
        actions.updateSection(selected.id, {
          content: { elements: [...elements, el] },
        } as Partial<FreeformSection>);
        setSelectedFreeformElementId(el.id);
        return;
      }
      actions.addFreeformElement(elementType);
      showToast('Design canvas added — drag layers to position them', 'success');
    },
    [state.layout.sections, state.selectedSectionId, actions, showToast]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.ctrlKey || event.metaKey;
      if (!isMeta || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) actions.redo();
      else actions.undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  const editingPageLabel =
    editingPageId === 'home'
      ? 'Home'
      : state.layout.websiteConfig?.pages.custom?.find((p) => p.id === editingPageId)?.title || 'Page';

  if (!responsiveState.canEdit) {
    return <BuilderMobileGate onClose={onClose} />;
  }

  if (isLoading) {
    return (
      <div className="builder-loading">
        <div className="loading-spinner" />
        <p>Loading editor...</p>
      </div>
    );
  }

  return (
    <BuilderMediaProvider storeId={storeId} layout={state.layout}>
    <BuilderCatalogueProvider
      storeId={storeId}
      storeSlug={storeSlug}
      sellerUserId={sellerUserId}
      catalogues={catalogues}
      catalogueId={catalogueId}
      currencyCode={currencyCode}
      storeWhatsapp={storeWhatsapp}
    >
    <div className="homepage-builder sites-editor">
      {isOfflineBuilderMode() && (
        <div className="builder-offline-banner" role="status">
          {USE_LOCAL_HOMEPAGE_STORE
            ? 'Drafts save on this device — Publish pushes the live site to Supabase so your subdomain stays in sync.'
            : 'Offline mode — some cloud features may be unavailable until Supabase is healthy.'}
        </div>
      )}
      <BuilderToolbar
        isDirty={state.isDirty}
        isSaving={state.isDirty && !isPublishing}
        isPublishing={isPublishing}
        error={state.error}
        pageLabel={editingPageLabel}
        viewport={viewport}
        publishedAt={config?.publishedAt}
        hasUnpublishedChanges={hasUnpublishedChanges}
        isLive={isLive}
        canViewLive={!!storeSlug}
        onViewportChange={setViewport}
        onSave={() => void handleSave()}
        onPublish={() => void handlePublish()}
        onViewLive={handleViewLive}
        onPreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
        canUndo={state.history.length > 0}
        canRedo={state.future.length > 0}
        onUndo={actions.undo}
        onRedo={actions.redo}
        onClose={onClose}
      />

      {hasUnpublishedChanges && isLive && (
        <div className="publish-banner" role="status">
          You have unpublished draft changes. Save draft or Publish to update the live storefront.
        </div>
      )}

      {showPreview ? (
        <div className="sites-editor-body">
          <main className="sites-canvas-area">
            <PreviewPane layout={state.layout} />
          </main>
        </div>
      ) : (
        <BuilderDndProvider
          sections={state.layout.sections}
          onInsertSectionAt={actions.insertSectionAt}
          onInsertPresetAt={actions.insertPresetAt}
          onReorderSections={actions.reorderSections}
        >
          <div className="sites-editor-body">
            <main className="sites-canvas-area">
              <div className={`sites-page-frame viewport-${viewport}`}>
                <GridCanvas
                  layout={state.layout}
                  theme={state.layout.theme}
                  storeId={storeId}
                  editingPageId={editingPageId}
                  selectedSectionId={state.selectedSectionId}
                  selectedFreeformElementId={selectedFreeformElementId}
                  onSelectFreeformElement={setSelectedFreeformElementId}
                  onAddFreeformLayer={addFreeformElement}
                  onSelectSection={handleSelectSection}
                  onRemoveSection={actions.removeSection}
                  onDuplicateSection={actions.duplicateSection}
                  onUpdateSectionPosition={actions.updateSectionPosition}
                  onUpdateSectionLayout={actions.updateSectionLayout}
                  onUpdateSection={actions.updateSection}
                  onReorderSections={actions.reorderSections}
                  onApplyTemplate={editingPageId === 'home' ? handleApplyTemplate : undefined}
                  onStartBlank={handleStartBlank}
                />
              </div>
            </main>

            <BuilderSidebar
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              selectedSectionId={state.selectedSectionId}
              selectedFreeformElementId={selectedFreeformElementId}
              onSelectFreeformElement={setSelectedFreeformElementId}
              sections={state.layout.sections}
              theme={state.layout.theme}
              websiteConfig={state.layout.websiteConfig || createDefaultWebsiteModeConfig()}
              editingPageId={editingPageId}
              storeId={storeId}
              storeSlug={storeSlug}
              onAddSection={actions.addSection}
              onAddFreeformElement={addFreeformElement}
              onAddPreset={actions.addBlockPreset}
              onUpdateSection={actions.updateSection}
              onUpdateTheme={handleUpdateTheme}
              onUpdateWebsiteConfig={updateWebsiteConfig}
              onSelectEditingPage={handleSelectEditingPage}
              onAddPage={handleAddPage}
              onRemovePage={handleRemovePage}
              onClearSectionSelection={() => actions.selectSection(null)}
              onApplyTemplate={handleApplyTemplate}
            />
          </div>
        </BuilderDndProvider>
      )}
    </div>
    </BuilderCatalogueProvider>
    </BuilderMediaProvider>
  );
}

function getPageLayout(websiteConfig: WebsiteModeConfig, pageId: string) {
  if (pageId === 'home') return websiteConfig.pages.home;
  return websiteConfig.pages.custom?.find((page) => page.id === pageId)?.layout || websiteConfig.pages.home;
}

function snapshotCurrentPageIntoWebsiteConfig(
  websiteConfig: WebsiteModeConfig,
  layout: { sections?: unknown[]; theme?: WebsiteModeConfig['pages']['home']['theme'] },
  editingPageId: string
): WebsiteModeConfig {
  const siteTheme = layout.theme || getSiteTheme(websiteConfig);

  if (editingPageId === 'home') {
    return syncSiteThemeAcrossPages({
      ...websiteConfig,
      pages: {
        ...websiteConfig.pages,
        home: {
          ...websiteConfig.pages.home,
          sections: (layout.sections || []) as WebsiteModeConfig['pages']['home']['sections'],
          theme: siteTheme,
        },
      },
    });
  }

  return syncSiteThemeAcrossPages({
    ...websiteConfig,
    pages: {
      ...websiteConfig.pages,
      custom: (websiteConfig.pages.custom || []).map((page) =>
        page.id === editingPageId
          ? {
              ...page,
              layout: {
                ...page.layout,
                sections: (layout.sections || []) as typeof page.layout.sections,
                theme: { ...siteTheme },
              },
            }
          : page
      ),
    },
  });
}
