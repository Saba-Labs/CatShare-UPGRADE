import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useHomepageBuilder } from '../../hooks/useHomepageBuilder';
import { useHomepageAutosave } from '../../hooks/useHomepageAutosave';
import { useResponsiveBuilder } from '../../hooks/useResponsiveBuilder';
import {
  getHomepageConfig,
  createHomepageConfig,
  updateHomepageLayout,
  publishHomepageConfig,
  unpublishHomepageConfig,
  restoreHomepageVersion,
} from '../../services/homepageService';
import { buildStorefrontUrl } from '../../utils/storefrontDomain';
import { homepageLayoutsEqual } from '../../utils/homepagePublish';
import {
  createEmptyHomepageLayout,
  createDefaultWebsiteModeConfig,
  normalizeHomepageLayoutForWebsiteMode,
} from '../../config/homepageBuilderConfig';
import { HomepageConfig, WebsiteModeConfig } from '../../types/homepage';
import BuilderToolbar, { ViewportSize } from './BuilderToolbar';
import BuilderSidebar, { SidebarTab } from './BuilderSidebar';
import GridCanvas from './GridCanvas';
import PreviewPane from './PreviewPane';
import { BuilderMediaProvider } from './media/BuilderMediaContext';
import PublishHistoryModal from './PublishHistoryModal';
import './HomepageBuilder.css';

interface HomepageBuilderProps {
  storeId: string;
  storeSlug?: string;
  onClose?: () => void;
}

export default function HomepageBuilder({ storeId, storeSlug, onClose }: HomepageBuilderProps) {
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
  const [showHistory, setShowHistory] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useHomepageAutosave({
    configId: config?.id || '',
    layout: state.layout,
    isDirty: state.isDirty,
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
          } catch {
            existingConfig = {
              id: `temp-${Date.now()}`,
              storeId,
              layout: emptyLayout,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
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

  const handleSave = async () => {
    if (!config) return;
    try {
      const updated = await updateHomepageLayout(config.id, buildDraftLayout());
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
    if (!config) return;
    try {
      setIsPublishing(true);
      const draftLayout = buildDraftLayout();
      await updateHomepageLayout(config.id, draftLayout);
      const published = await publishHomepageConfig(config.id, draftLayout, {
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

  const handleRestoreVersion = async (versionId: string, target: 'draft' | 'live') => {
    if (!config) return;
    try {
      setIsRestoring(true);
      const updated = await restoreHomepageVersion(config.id, versionId, target === 'live' ? 'live' : 'draft');
      const normalized = normalizeHomepageLayoutForWebsiteMode(updated.layout);
      setConfig({ ...updated, layout: normalized });
      actions.setLayout(normalized);
      actions.markSaved();
      setShowHistory(false);
      showToast(target === 'live' ? 'Version published to live site' : 'Version loaded into draft', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to restore version';
      showToast(msg, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUnpublish = async () => {
    if (!config) return;
    try {
      setIsRestoring(true);
      const updated = await unpublishHomepageConfig(config.id);
      setConfig(updated);
      setShowHistory(false);
      showToast('Live site unpublished', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to unpublish';
      showToast(msg, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const draftLayoutForCompare = useMemo(() => buildDraftLayout(), [state.layout, editingPageId]);

  const hasUnpublishedChanges = useMemo(
    () => !homepageLayoutsEqual(draftLayoutForCompare, config?.publishedLayout),
    [draftLayoutForCompare, config?.publishedLayout]
  );

  const isLive = !!config?.publishedLayout && !!config?.publishedAt;

  const updateWebsiteConfig = (updates: Partial<WebsiteModeConfig>) => {
    const current = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    actions.updateWebsiteConfig({
      ...current,
      ...updates,
      siteSettings: { ...current.siteSettings, ...(updates.siteSettings || {}) },
      templates: { ...current.templates, ...(updates.templates || {}) },
      pages: { ...current.pages, ...(updates.pages || {}) },
    });
  };

  const handleSelectEditingPage = (nextPageId: string) => {
    if (nextPageId === editingPageId) return;
    const currentWebsiteConfig = state.layout.websiteConfig || createDefaultWebsiteModeConfig();
    const withSnapshot = snapshotCurrentPageIntoWebsiteConfig(currentWebsiteConfig, state.layout, editingPageId);
    const nextPageLayout = getPageLayout(withSnapshot, nextPageId);
    actions.setLayout({
      ...state.layout,
      sections: nextPageLayout.sections || [],
      theme: nextPageLayout.theme || state.layout.theme,
      websiteConfig: withSnapshot,
    });
    actions.updateWebsiteConfig(withSnapshot);
    actions.selectSection(null);
    setEditingPageId(nextPageId);
  };

  const handleSelectSection = (id: string | null) => {
    actions.selectSection(id);
  };

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
    return (
      <div className="builder-mobile-restriction">
        <div className="restriction-content">
          <div className="restriction-icon">📱</div>
          <h2>Editor not available on mobile</h2>
          <p>Please use a desktop or tablet to edit your site.</p>
          <button className="btn-primary" type="button" onClick={onClose}>
            Go back
          </button>
        </div>
      </div>
    );
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
    <BuilderMediaProvider storeId={storeId}>
    <div className="homepage-builder sites-editor">
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
        onOpenHistory={() => setShowHistory(true)}
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

      {showHistory && config && (
        <PublishHistoryModal
          history={config.publishHistory || []}
          publishedAt={config.publishedAt}
          isRestoring={isRestoring}
          onClose={() => setShowHistory(false)}
          onRestoreDraft={(id) => void handleRestoreVersion(id, 'draft')}
          onRestoreLive={(id) => void handleRestoreVersion(id, 'live')}
          onUnpublish={() => void handleUnpublish()}
        />
      )}

      <div className="sites-editor-body">
        <main className="sites-canvas-area">
          {showPreview ? (
            <PreviewPane layout={state.layout} />
          ) : (
            <div className={`sites-page-frame viewport-${viewport}`}>
              <GridCanvas
                layout={state.layout}
                theme={state.layout.theme}
                storeId={storeId}
                selectedSectionId={state.selectedSectionId}
                onSelectSection={handleSelectSection}
                onRemoveSection={actions.removeSection}
                onDuplicateSection={actions.duplicateSection}
                onUpdateSectionPosition={actions.updateSectionPosition}
                onUpdateSection={actions.updateSection}
              />
            </div>
          )}
        </main>

        <BuilderSidebar
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          selectedSectionId={state.selectedSectionId}
          sections={state.layout.sections}
          theme={state.layout.theme}
          websiteConfig={state.layout.websiteConfig || createDefaultWebsiteModeConfig()}
          editingPageId={editingPageId}
          storeId={storeId}
          storeSlug={storeSlug}
          onAddSection={actions.addSection}
          onAddPreset={actions.addBlockPreset}
          onUpdateSection={actions.updateSection}
          onUpdateTheme={actions.updateTheme}
          onUpdateWebsiteConfig={updateWebsiteConfig}
          onSelectEditingPage={handleSelectEditingPage}
          onClearSectionSelection={() => actions.selectSection(null)}
        />
      </div>
    </div>
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
  if (editingPageId === 'home') {
    return {
      ...websiteConfig,
      pages: {
        ...websiteConfig.pages,
        home: {
          ...websiteConfig.pages.home,
          sections: (layout.sections || []) as WebsiteModeConfig['pages']['home']['sections'],
          theme: layout.theme || websiteConfig.pages.home.theme,
        },
      },
    };
  }

  return {
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
                theme: layout.theme || page.layout.theme,
              },
            }
          : page
      ),
    },
  };
}
