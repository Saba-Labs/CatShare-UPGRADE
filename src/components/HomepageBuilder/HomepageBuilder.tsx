import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useHomepageBuilder } from '../../hooks/useHomepageBuilder';
import { useHomepageAutosave } from '../../hooks/useHomepageAutosave';
import { useResponsiveBuilder } from '../../hooks/useResponsiveBuilder';
import { getHomepageConfig, createHomepageConfig, updateHomepageLayout } from '../../services/homepageService';
import { createEmptyHomepageLayout } from '../../config/homepageBuilderConfig';
import { HomepageConfig, GridPosition } from '../../types/homepage';
import BuilderToolbar from './BuilderToolbar';
import ComponentPalette from './ComponentPalette';
import GridCanvas from './GridCanvas';
import PropertiesPanel from './PropertiesPanel';
import PreviewPane from './PreviewPane';
import './HomepageBuilder.css';

interface HomepageBuilderProps {
  storeId: string;
  onClose?: () => void;
}

export default function HomepageBuilder({ storeId, onClose }: HomepageBuilderProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { state, actions } = useHomepageBuilder();
  const responsiveState = useResponsiveBuilder();
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const { saveNow } = useHomepageAutosave({
    configId: config?.id || '',
    layout: state.layout,
    isDirty: state.isDirty,
    debounceMs: 2000,
    onSaveStart: () => {
      // Can add visual feedback here
    },
    onSaveComplete: () => {
      actions.markSaved();
      showToast('Homepage auto-saved', 'success');
    },
    onSaveError: (error) => {
      actions.setError(error.message);
      showToast(`Failed to save: ${error.message}`, 'error');
    },
  });

  // Load existing config or create new one
  useEffect(() => {
    const loadConfig = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Config loading timed out after 10 seconds')), 10000)
      );

      try {
        setIsLoading(true);
        console.log('[HomepageBuilder] Starting config load for storeId:', storeId);

        let existingConfig: any = null;
        try {
          existingConfig = await Promise.race([
            getHomepageConfig(storeId),
            timeoutPromise as Promise<any>
          ]);
        } catch (fetchError) {
          console.warn('[HomepageBuilder] Failed to fetch existing config:', fetchError);
          // Continue to create a new one instead of failing
        }

        if (!existingConfig) {
          console.log('[HomepageBuilder] No existing config, creating new one');
          // Create new config with empty layout
          const emptyLayout = createEmptyHomepageLayout();
          try {
            existingConfig = await Promise.race([
              createHomepageConfig(storeId, emptyLayout),
              timeoutPromise as Promise<any>
            ]);
          } catch (createError) {
            console.warn('[HomepageBuilder] Failed to create config, using fallback:', createError);
            // Use fallback in-memory config if creation fails
            existingConfig = {
              id: `temp-${Date.now()}`,
              storeId,
              layout: emptyLayout,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
        }

        console.log('[HomepageBuilder] Config loaded successfully:', existingConfig);
        setConfig(existingConfig);
        actions.setLayout(existingConfig.layout);
      } catch (error) {
        console.error('[HomepageBuilder] Unexpected error loading config:', error);
        const msg = error instanceof Error ? error.message : 'Failed to load homepage config';
        actions.setError(msg);
        showToast(msg, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [storeId, showToast]);

  const handleSave = async () => {
    if (!config) return;

    try {
      const updated = await updateHomepageLayout(config.id, state.layout);
      setConfig(updated);
      actions.markSaved();
      showToast('Homepage saved successfully', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save homepage';
      actions.setError(msg);
      showToast(msg, 'error');
    }
  };

  if (!responsiveState.canEdit) {
    return (
      <div className="builder-mobile-restriction">
        <div className="restriction-content">
          <div className="restriction-icon">📱</div>
          <h2>Homepage Editor Not Available on Mobile</h2>
          <p>The homepage builder is optimized for desktop editing. Please use a desktop or tablet to edit your store homepage.</p>
          <button className="btn-primary" onClick={onClose}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="builder-loading">
        <div className="loading-spinner"></div>
        <p>Loading homepage builder...</p>
      </div>
    );
  }

  return (
    <div className="homepage-builder">
      <BuilderToolbar
        isDirty={state.isDirty}
        isSaving={state.isDirty}
        error={state.error}
        onSave={handleSave}
        onSaveNow={saveNow}
        onPreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
        onClose={onClose}
      />

      <div className="builder-layout">
        <ComponentPalette onAddSection={actions.addSection} />

        {showPreview ? (
          <PreviewPane layout={state.layout} />
        ) : (
          <GridCanvas
            layout={state.layout}
            selectedSectionId={state.selectedSectionId}
            onSelectSection={actions.selectSection}
            onRemoveSection={actions.removeSection}
            onDuplicateSection={actions.duplicateSection}
            onUpdateSectionPosition={actions.updateSectionPosition}
          />
        )}

        <PropertiesPanel
          selectedSectionId={state.selectedSectionId}
          sections={state.layout.sections}
          theme={state.layout.theme}
          onUpdateSection={actions.updateSection}
          onUpdateTheme={actions.updateTheme}
          storeId={storeId}
        />
      </div>
    </div>
  );
}
