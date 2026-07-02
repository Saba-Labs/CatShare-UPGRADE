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
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import { HomepageConfig, HomepageLayout, ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { getSymbolForCurrencyCode } from '../../utils/currencyUtils';
import BuilderProductPageOverlay from './BuilderProductPageOverlay';
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
import CookThemeWizard from './CookThemeWizard';
import './HomepageBuilder.css';

interface HomepageBuilderProps {
  storeId: string;
  storeSlug?: string;
  sellerUserId?: string;
  store?: StorePublic | null;
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
  store,
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
  const [previewProduct, setPreviewProduct] = useState<ProductWithCatalogueData | null>(null);
  const [cookThemeOpen, setCookThemeOpen] = useState(false);

  const configPersisted = isPersistedHomepageConfigId(config?.id);

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
      const normalizedDraftLayout = normalizeHomepageLayoutForWebsiteMode(published.layout);
      const normalizedPublishedLayout = published.publishedLayout
        ? normalizeHomepageLayoutForWebsiteMode(published.publishedLayout)
        : published.publishedLayout;
      setConfig({
        ...published,
        layout: normalizedDraftLayout,
        publishedLayout: normalizedPublishedLayout,
      });
      actions.setLayout(normalizedDraftLayout);
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

  useHomepageAutosave({
    configId: config?.id || '',
    layout: draftLayoutForCompare,
    isDirty: state.isDirty,
    enabled: configPersisted,
    debounceMs: 2000,
    onSaveComplete: () => {
      actions.markSaved();
    },
    onSaveError: (error) => {
      actions.setError(error.message);
      showToast(`Failed to save: ${error.message}`, 'error');
    },
  });

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
        `Apply the "${tpl.name}" theme to your whole site? Your home page content will be replaced. Custom pages keep their sections but use the same colors, footer, and shop styling.`
      );
      if (!ok) return;
    }

    const built = tpl.build();
    applyBuiltWebsiteConfig(
      built,
      withSnapshot,
      state.layout,
      editingPageId,
      actions,
      { activeTemplateId: templateId, toastMessage: `Applied ${tpl.name} theme across your site` },
      showToast
    );
    setEditingPageId('home');
    setSidebarTab('insert');
  };

  const handleCookThemeOpen = () => {
    setCookThemeOpen(true);
  };

  const handleCookThemeComplete = (built: WebsiteModeConfig) => {
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const withSnapshot = snapshotCurrentPageIntoWebsiteConfig(current, state.layout, editingPageId);

    applyBuiltWebsiteConfig(
      built,
      withSnapshot,
      state.layout,
      editingPageId,
      actions,
      { toastMessage: 'Your theme is ready — customize any block on the canvas' },
      showToast
    );
    setEditingPageId('home');
    setSidebarTab('insert');
  };

  const homeHasContent = (state.layout.sections || []).length > 0;

  const showThemeHub =
    editingPageId === 'home' &&
    sidebarTab === 'templates' &&
    !previewProduct &&
    !showPreview;

  useEffect(() => {
    if (!isLoading && editingPageId === 'home' && state.layout.sections.length === 0) {
      setSidebarTab('templates');
    }
  }, [isLoading, editingPageId, state.layout.sections.length]);

  const handleSidebarTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab);
    if (tab === 'templates') {
      actions.selectSection(null);
      setSelectedFreeformElementId(null);
      setPreviewProduct(null);
    }
  }, [actions]);

  const handleStartBlank = () => {
    setSidebarTab('insert');
  };

  const handleSelectSection = (id: string | null) => {
    actions.selectSection(id);
    setSelectedFreeformElementId(null);
    setPreviewProduct(null);
  };

  const handleOverlaySelectSection = useCallback((id: string | null) => {
    // Keep product preview open while selecting header/footer/announcement in overlay.
    actions.selectSection(id);
    setSelectedFreeformElementId(null);
  }, [actions]);

  const handleProductPreview = useCallback((product: ProductWithCatalogueData) => {
    setPreviewProduct(product);
    actions.selectSection(null);
    setSelectedFreeformElementId(null);
  }, [actions]);

  const previewCatalogue = useMemo(() => {
    if (!catalogues?.length) return null;
    if (catalogueId) {
      return catalogues.find((c) => c.id === catalogueId) ?? catalogues[0];
    }
    return catalogues[0];
  }, [catalogues, catalogueId]);

  const currencySymbol = useMemo(
    () => getSymbolForCurrencyCode(currencyCode || 'INR'),
    [currencyCode]
  );

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
  const viewportClassName = `viewport-${viewport}`;

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
        <div className={`sites-editor-body ${viewportClassName}`}>
          <main className={`sites-canvas-area ${viewportClassName}`}>
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
          <div className={`sites-editor-body ${viewportClassName}${showThemeHub ? ' sites-editor-body--theme-hub' : ''}`}>
            <main className={`sites-canvas-area ${viewportClassName}${showThemeHub ? ' sites-canvas-area--theme-hub' : ''}`}>
              {previewProduct ? (
                <BuilderProductPageOverlay
                  product={previewProduct}
                  template={
                    state.layout.websiteConfig?.templates.product ||
                    createDefaultWebsiteModeConfig().templates.product
                  }
                  theme={state.layout.theme}
                  siteSettings={state.layout.websiteConfig?.siteSettings}
                  currencySymbol={currencySymbol}
                  catalogue={previewCatalogue}
                  viewport={viewport}
                  selectedSectionId={state.selectedSectionId}
                  onSelectSection={handleOverlaySelectSection}
                  onClose={() => setPreviewProduct(null)}
                />
              ) : (
                <div className={`sites-page-frame viewport-${viewport}${showThemeHub ? ' sites-page-frame--theme-hub' : ''}`}>
                  <GridCanvas
                    layout={state.layout}
                    theme={state.layout.theme}
                    storeId={storeId}
                    store={store}
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
                    onCookTheme={editingPageId === 'home' ? handleCookThemeOpen : undefined}
                    themeHubMode={showThemeHub}
                    onProductPreview={handleProductPreview}
                  />
                </div>
              )}
            </main>

            <BuilderSidebar
              activeTab={sidebarTab}
              onTabChange={handleSidebarTabChange}
              themeHubMode={showThemeHub}
              previewProduct={previewProduct}
              onCloseProductPreview={() => setPreviewProduct(null)}
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
              onCookTheme={handleCookThemeOpen}
            />
          </div>
        </BuilderDndProvider>
      )}

      <CookThemeWizard
        open={cookThemeOpen}
        storeName={store?.sellerBusinessName || state.layout.websiteConfig?.siteSettings?.websiteName}
        confirmReplace={homeHasContent}
        onClose={() => setCookThemeOpen(false)}
        onComplete={handleCookThemeComplete}
      />
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

type BuilderActions = ReturnType<typeof useHomepageBuilder>['actions'];

function applyBuiltWebsiteConfig(
  built: WebsiteModeConfig,
  withSnapshot: WebsiteModeConfig,
  layout: HomepageLayout,
  _editingPageId: string,
  actions: BuilderActions,
  options?: { activeTemplateId?: WebsiteTemplateId; toastMessage?: string },
  showToast?: (msg: string, type: 'success' | 'error' | 'warning') => void
) {
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
    ...(options?.activeTemplateId ? { activeTemplateId: options.activeTemplateId } : {}),
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
    sections: (built.pages.home.sections || []) as HomepageLayout['sections'],
    theme: built.pages.home.theme || layout.theme,
  });
  actions.selectSection(null);
  if (options?.toastMessage && showToast) {
    showToast(options.toastMessage, 'success');
  }
}
