import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useDndContext } from '@dnd-kit/core';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StorePublic } from '../../services/storeService';
import {
  BlockAlign,
  BlockLayout,
  FreeformElementType,
  HomepageLayout,
  HomepageSection,
  ThemeSettings,
} from '../../types/homepage';
import SortableGridSection from './SortableGridSection';
import SectionRenderer from './sections/SectionRenderer';
import TemplateGallery from './TemplateGallery';
import type { WebsiteTemplateId } from '../../config/websiteTemplates';
import { isCatalogClassicFooter } from '../../config/footerVariants';
import {
  SECTION_TYPE_LABELS,
  SITE_ANNOUNCEMENT_SELECTION_ID,
  SITE_FOOTER_SELECTION_ID,
  SITE_HEADER_SELECTION_ID,
} from '../../config/homepageBuilderConfig';
import { useBuilderMedia } from './media/BuilderMediaContext';
import {
  applyMediaUrlToSection,
  applyMediaUrlsToSection,
  sectionSupportsMultiMedia,
  sectionSupportsQuickMedia,
} from '../../utils/sectionMedia';
import {
  getBlockAlign,
  getBlockInnerStyle,
  getBlockRowStyle,
  getBlockWidthPercent,
  snapBlockWidth,
  snapBlockHeight,
} from '../../utils/blockLayout';
import { preventBuilderLinkNavigation } from '../../utils/builderNavigation';
import {
  isBuilderEditInteractionTarget,
  isBuilderSectionChromeTarget,
} from '../../utils/builderEditGuards';
import WebsiteFooter from '../WebsiteBuilder/WebsiteFooter';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';
import { headerLayoutForVariant } from '../../config/headerVariants';
import { homepageUsesImmersiveHeroOverlay } from '../../utils/immersiveHeaderOverlay';
import SectionDropIndicator from './dnd/SectionDropIndicator';
import { isPaletteDragId } from './dnd/builderDndTypes';
import './GridCanvas.css';

interface GridCanvasProps {
  layout: HomepageLayout;
  theme: ThemeSettings;
  storeId: string;
  store?: StorePublic | null;
  editingPageId?: string;
  selectedSectionId: string | null;
  selectedFreeformElementId?: string | null;
  onSelectFreeformElement?: (elementId: string | null) => void;
  onAddFreeformLayer?: (type: FreeformElementType) => void;
  onSelectSection: (id: string | null) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
  onUpdateSectionLayout: (id: string, blockLayout: BlockLayout) => void;
  onReorderSections: (sections: HomepageSection[]) => void;
  onApplyTemplate?: (id: WebsiteTemplateId) => void;
  onCookTheme?: () => void;
  onStartBlank?: () => void;
  themeHubMode?: boolean;
  blankStarted?: boolean;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
  onCategoryPreview?: (category: { id: string; label: string }) => void;
  /** @deprecated Grid resize kept for API compat; editor uses document stack layout. */
  onUpdateSectionPosition?: (id: string, position: unknown) => void;
}

const ALIGN_OPTIONS: Array<{ value: BlockAlign; label: string }> = [
  { value: 'left', label: '◧' },
  { value: 'center', label: '▣' },
  { value: 'right', label: '◨' },
];

export default function GridCanvas({
  layout,
  theme,
  storeId,
  store,
  editingPageId = 'home',
  selectedSectionId,
  selectedFreeformElementId = null,
  onSelectFreeformElement,
  onAddFreeformLayer,
  onSelectSection,
  onRemoveSection,
  onDuplicateSection,
  onUpdateSection,
  onUpdateSectionLayout,
  onReorderSections,
  onApplyTemplate,
  onStartBlank,
  onCookTheme,
  themeHubMode = false,
  blankStarted = false,
  onProductPreview,
  onCategoryPreview,
}: GridCanvasProps) {
  const { openMediaPicker } = useBuilderMedia();
  const { active } = useDndContext();
  const paletteDragActive = active ? isPaletteDragId(String(active.id)) : false;
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sectionCountRef = useRef(layout.sections.length);
  const [dragState, setDragState] = useState<{ id: string; widthPercent: number } | null>(null);
  const [heightDragState, setHeightDragState] = useState<{ id: string; heightPx: number } | null>(null);

  const sortedSections = useMemo(
    () => [...layout.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [layout.sections]
  );
  const siteSettings = layout.websiteConfig?.siteSettings;
  const headerLayout = headerLayoutForVariant(siteSettings?.headerVariant);
  const immersiveHeroOverlay = homepageUsesImmersiveHeroOverlay(siteSettings?.headerVariant, sortedSections);
  const overlayHeaderInEditor = headerLayout === 'floating' || immersiveHeroOverlay;
  const showTemplatePicker =
    themeHubMode ||
    (sortedSections.length === 0 &&
      editingPageId === 'home' &&
      !!onApplyTemplate &&
      !blankStarted);
  const showSiteFooter = !!siteSettings && !showTemplatePicker && sortedSections.length > 0;
  const catalogClassicFooter = !!siteSettings && isCatalogClassicFooter(siteSettings);
  const isSiteFooterSelected = selectedSectionId === SITE_FOOTER_SELECTION_ID;
  const isSiteAnnouncementSelected = selectedSectionId === SITE_ANNOUNCEMENT_SELECTION_ID;
  const isSiteHeaderSelected = selectedSectionId === SITE_HEADER_SELECTION_ID;

  const handleSectionClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelectSection(id);
  };

  useEffect(() => {
    const currentCount = layout.sections.length;
    const prevCount = sectionCountRef.current;
    const addedSections = currentCount > prevCount;

    if (addedSections && selectedSectionId) {
      const targetId = selectedSectionId;
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          blockRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      sectionCountRef.current = currentCount;
      return () => cancelAnimationFrame(frame);
    }

    sectionCountRef.current = currentCount;
  }, [layout.sections.length, selectedSectionId]);

  const beginResize = (e: React.PointerEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const row = rowRefs.current[sectionId];
    if (!row) return;
    const rowWidth = row.getBoundingClientRect().width;
    if (rowWidth <= 0) return;

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = row.getBoundingClientRect();
      const align = getBlockAlign(sortedSections.find((s) => s.id === sectionId)?.blockLayout);
      let ratio: number;
      if (align === 'left') {
        ratio = (moveEvent.clientX - rect.left) / rowWidth;
      } else if (align === 'right') {
        ratio = (rect.right - moveEvent.clientX) / rowWidth;
      } else {
        const center = rect.left + rowWidth / 2;
        ratio = (Math.abs(moveEvent.clientX - center) * 2) / rowWidth;
      }
      const widthPercent = snapBlockWidth(ratio * 100);
      setDragState({ id: sectionId, widthPercent });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setDragState((current) => {
        if (current && current.id === sectionId) {
          onUpdateSectionLayout(sectionId, { widthPercent: current.widthPercent });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const beginHeightResize = (e: React.PointerEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const block = blockRefs.current[sectionId];
    if (!block) return;

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = block.getBoundingClientRect();
      const heightPx = snapBlockHeight(moveEvent.clientY - rect.top);
      setHeightDragState({ id: sectionId, heightPx });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setHeightDragState((current) => {
        if (current && current.id === sectionId) {
          onUpdateSectionLayout(sectionId, { heightPx: current.heightPx });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const resetHeight = (sectionId: string) => {
    onUpdateSectionLayout(sectionId, { heightPx: undefined });
  };

  const setWidth = (sectionId: string, widthPercent: number) => {
    onUpdateSectionLayout(sectionId, { widthPercent });
  };

  const setAlign = (sectionId: string, align: BlockAlign) => {
    onUpdateSectionLayout(sectionId, { align });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isBuilderEditInteractionTarget(e.target) || isBuilderSectionChromeTarget(e.target)) return;
    onSelectSection(null);
  };

  return (
    <div
      className={`grid-canvas-container sites-canvas${
        overlayHeaderInEditor ? ' sites-canvas--overlay-header' : ''
      }${immersiveHeroOverlay ? ' sites-canvas--immersive-hero' : ''}${
        showTemplatePicker ? ' sites-canvas--theme-hub-active' : ''
      }`}
      onPointerDown={handleCanvasPointerDown}
      onClickCapture={preventBuilderLinkNavigation}
      style={{
        fontFamily: theme.fontFamily || undefined,
        color: theme.textColor || undefined,
        backgroundColor: theme.backgroundColor || '#fff',
        ['--site-primary' as string]: theme.primaryColor || '#1a73e8',
      }}
    >
      <div className={`grid-canvas-chrome${showTemplatePicker ? ' grid-canvas-chrome--hidden' : ''}`}>
      {siteSettings ? (
        <StorefrontSiteHeader
          siteSettings={siteSettings}
          preview
          immersiveOverHero={immersiveHeroOverlay}
          onSelectAnnouncement={() => onSelectSection(SITE_ANNOUNCEMENT_SELECTION_ID)}
          isAnnouncementSelected={isSiteAnnouncementSelected}
          onSelectHeader={() => onSelectSection(SITE_HEADER_SELECTION_ID)}
          isHeaderSelected={isSiteHeaderSelected}
        />
      ) : (
        <div className="sites-editor-header-preview">
          <div className="sites-editor-header-inner">
            <span className="sites-editor-header-brand">My Store</span>
          </div>
        </div>
      )}
      </div>
      <div className="grid-canvas-stage">
        <div
          className={`grid-canvas-layer grid-canvas-layer--theme-hub${showTemplatePicker ? ' is-active' : ''}`}
          onClick={(e) => e.stopPropagation()}
          aria-hidden={!showTemplatePicker}
        >
          <div className="canvas-empty sites-canvas-empty sites-canvas-empty--template-picker sites-canvas-empty--theme-hub">
            <TemplateGallery
              variant="full"
              onApply={onApplyTemplate!}
              onCookTheme={onCookTheme}
              onStartBlank={onStartBlank}
            />
          </div>
        </div>

        <div
          className={`grid-canvas-layer grid-canvas-layer--editor${showTemplatePicker ? '' : ' is-active'}`}
          aria-hidden={showTemplatePicker}
        >
      {sortedSections.length === 0 ? (
        <div
          className="canvas-empty sites-canvas-empty"
          onClick={(e) => e.stopPropagation()}
        >
          <SectionDropIndicator index={0} expanded={paletteDragActive} />
          <p>
            {editingPageId === 'home'
              ? 'Drag a block here or click Insert to start'
              : 'Drag blocks from Insert onto this page'}
          </p>
        </div>
      ) : (
            <div className="sites-document-stack">
              <SectionDropIndicator index={0} expanded={paletteDragActive} />
              {sortedSections.map((section, sectionIndex) => {
                const isSelected = selectedSectionId === section.id;
                const isFreeform = section.type === 'freeform';
                const liveWidth =
                  dragState && dragState.id === section.id
                    ? dragState.widthPercent
                    : getBlockWidthPercent(section.blockLayout);
                const align = getBlockAlign(section.blockLayout);
                const liveHeight =
                  heightDragState && heightDragState.id === section.id
                    ? heightDragState.heightPx
                    : section.blockLayout?.heightPx;
                const innerStyle = {
                  ...getBlockInnerStyle(section.blockLayout),
                  width: isFreeform ? '100%' : `${liveWidth}%`,
                  ...(liveHeight && !isFreeform ? { height: `${liveHeight}px`, overflow: 'hidden' as const } : {}),
                };
                return (
                  <Fragment key={section.id}>
                  <SortableGridSection id={section.id}>
                    {({ isDragging, listeners, attributes: handleAttributes }) => (
                      <>
                        <div
                          className="sites-section-drag-grip"
                          title="Drag to move"
                          aria-label="Drag section to reorder"
                          {...listeners}
                          {...handleAttributes}
                        >
                          <span className="sites-drag-grip-dots" aria-hidden />
                        </div>
                        <div
                          className="sites-block-row-body"
                          style={getBlockRowStyle(section.blockLayout)}
                          ref={(el) => {
                            rowRefs.current[section.id] = el;
                          }}
                        >
                          <div
                  className={`sites-document-block${isFreeform ? ' freeform-block-wrap' : ''} ${isSelected ? 'selected' : ''} ${
                    dragState?.id === section.id || heightDragState?.id === section.id ? 'resizing' : ''
                  }${isDragging ? ' dragging' : ''}`}
                  style={innerStyle}
                  ref={(el) => {
                    blockRefs.current[section.id] = el;
                  }}
                  onClick={(e) => handleSectionClick(e, section.id)}
                >
                  {isSelected && (
                    <div
                      className="sites-floating-toolbar"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span className="sites-floating-label">{SECTION_TYPE_LABELS[section.type]}</span>
                      <span className="sites-floating-hint">
                        {isFreeform
                          ? 'Click canvas to edit layers'
                          : 'Drag block to move'}
                      </span>
                      {!isFreeform && (
                      <div className="sites-align-group">
                        {ALIGN_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`sites-float-btn icon ${align === opt.value ? 'active' : ''}`}
                            title={`Align ${opt.value}`}
                            onClick={() => setAlign(section.id, opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      )}
                      {!isFreeform && (
                      <div className="sites-width-group">
                        {[50, 75, 100].map((w) => (
                          <button
                            key={w}
                            type="button"
                            className={`sites-float-btn icon ${liveWidth === w ? 'active' : ''}`}
                            title={`${w}% width`}
                            onClick={() => setWidth(section.id, w)}
                          >
                            {w}%
                          </button>
                        ))}
                        {section.blockLayout?.heightPx ? (
                          <button
                            type="button"
                            className="sites-float-btn icon"
                            title="Reset height to fit content"
                            onClick={() => resetHeight(section.id)}
                          >
                            ↕ Auto
                          </button>
                        ) : null}
                      </div>
                      )}
                      {sectionSupportsQuickMedia(section.type) && (
                        <button
                          type="button"
                          className="sites-float-btn"
                          onClick={() => {
                            const isMulti = sectionSupportsMultiMedia(section.type);
                            openMediaPicker({
                              storeId,
                              assetKey: `${section.id}-quick`,
                              title: isMulti ? 'Add carousel images' : 'Choose image',
                              multiple: isMulti,
                              onSelect: isMulti
                                ? undefined
                                : (url) => {
                                    const patch = applyMediaUrlToSection(section, url);
                                    if (patch) onUpdateSection(section.id, patch);
                                  },
                              onSelectMultiple: isMulti
                                ? (urls) => {
                                    const patch = applyMediaUrlsToSection(section, urls);
                                    if (patch) onUpdateSection(section.id, patch);
                                  }
                                : undefined,
                            });
                          }}
                        >
                          {sectionSupportsMultiMedia(section.type) ? 'Images' : 'Image'}
                        </button>
                      )}
                      <button type="button" className="sites-float-btn" onClick={() => onDuplicateSection(section.id)}>
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="sites-float-btn danger"
                        onClick={() => onRemoveSection(section.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  <SectionRenderer
                    section={section}
                    theme={theme}
                    storeId={storeId}
                    editMode={isSelected}
                    builderCanvas
                    onProductPreview={onProductPreview}
                    onCategoryPreview={onCategoryPreview}
                    selectedFreeformElementId={
                      isFreeform && isSelected ? selectedFreeformElementId : null
                    }
                    onSelectFreeformElement={
                      isFreeform ? onSelectFreeformElement : undefined
                    }
                    onAddFreeformLayer={
                      isFreeform && isSelected ? onAddFreeformLayer : undefined
                    }
                    onActivateFreeform={
                      isFreeform && !isSelected
                        ? () => onSelectSection(section.id)
                        : undefined
                    }
                    onUpdateSection={(updates) => onUpdateSection(section.id, updates)}
                  />

                  {isSelected && !isFreeform && (
                    <>
                      <div
                        className="sites-resize-handle right"
                        title="Drag to resize width"
                        onPointerDown={(e) => beginResize(e, section.id)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="sites-resize-pill" />
                      </div>
                      <div
                        className="sites-resize-handle bottom"
                        title="Drag to resize height"
                        onPointerDown={(e) => beginHeightResize(e, section.id)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="sites-resize-pill horizontal" />
                      </div>
                      {dragState?.id === section.id && (
                        <div className="sites-resize-badge">{liveWidth}%</div>
                      )}
                      {heightDragState?.id === section.id && (
                        <div className="sites-resize-badge bottom-left">{liveHeight}px</div>
                      )}
                    </>
                  )}
                </div>
                        </div>
                      </>
                    )}
                  </SortableGridSection>
                  <SectionDropIndicator index={sectionIndex + 1} expanded={paletteDragActive} />
                  </Fragment>
                );
              })}
            </div>
      )}
      {showSiteFooter && (
        <div
          className={`sites-editor-footer-preview${
            catalogClassicFooter ? ' sites-editor-footer-preview--catalog' : ''
          }${
            siteSettings.footerWidth === 'full' ? ' sites-editor-footer-preview--full' : ''
          }${isSiteFooterSelected ? ' selected' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Edit site footer"
          aria-pressed={isSiteFooterSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSection(SITE_FOOTER_SELECTION_ID);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onSelectSection(SITE_FOOTER_SELECTION_ID);
            }
          }}
        >
          {isSiteFooterSelected && (
            <div className="sites-footer-selection-label" onClick={(e) => e.stopPropagation()}>
              Footer
            </div>
          )}
          <WebsiteFooter
            siteSettings={siteSettings}
            previewMode
          />
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
