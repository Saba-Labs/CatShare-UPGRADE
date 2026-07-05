import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiImage, FiSquare, FiType } from 'react-icons/fi';
import type {
  FreeformElement,
  FreeformElementType,
  FreeformImageElement,
  FreeformSection,
  ThemeSettings,
} from '../../../types/homepage';
import {
  normalizeFreeformLayout,
  normalizeFreeformElementsList,
  patchFreeformElementInList,
  sortFreeformElements,
} from '../../../utils/freeformElements';
import { getBuilderButtonStyles } from '../../../utils/buttonStyleUtils';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import { useBuilderMediaOptional } from '../media/BuilderMediaContext';
import './FreeformSectionView.css';

interface FreeformSectionViewProps {
  section: FreeformSection & { id: string };
  theme?: ThemeSettings;
  storeId?: string;
  editMode?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  onAddLayer?: (type: FreeformElementType) => void;
  onActivate?: () => void;
  onUpdateSection?: (updates: Partial<FreeformSection>) => void;
}

const LAYER_LABELS: Record<FreeformElementType, string> = {
  text: 'Text',
  image: 'Image',
  button: 'Button',
};

const LAYER_ICONS: Record<FreeformElementType, React.ComponentType<{ className?: string }>> = {
  text: FiType,
  image: FiImage,
  button: FiSquare,
};

function layoutToStyle(layout: FreeformElement['layout']): React.CSSProperties {
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${layout.width}%`,
    height: `${layout.height}%`,
    zIndex: layout.zIndex,
  };
}

export default function FreeformSectionView({
  section,
  theme,
  storeId,
  editMode = false,
  selectedElementId = null,
  onSelectElement,
  onAddLayer,
  onActivate,
  onUpdateSection,
}: FreeformSectionViewProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef(section);
  const pickerOpenedForRef = useRef<Set<string>>(new Set());
  sectionRef.current = section;

  const [liveLayout, setLiveLayout] = useState<{
    elementId: string;
    layout: FreeformElement['layout'];
  } | null>(null);

  const media = useBuilderMediaOptional();

  const elements = useMemo(
    () => sortFreeformElements(normalizeFreeformElementsList(section.content?.elements)),
    [section.content?.elements]
  );

  const pushElements = useCallback(
    (nextElements: FreeformElement[]) => {
      onUpdateSection?.({ content: { elements: nextElements } });
    },
    [onUpdateSection]
  );

  const patchElement = useCallback(
    (elementId: string, patch: Partial<FreeformElement>) => {
      const current = normalizeFreeformElementsList(sectionRef.current.content?.elements);
      pushElements(patchFreeformElementInList(current, elementId, patch));
    },
    [pushElements]
  );

  const commitLayout = useCallback(
    (elementId: string, layout: FreeformElement['layout']) => {
      patchElement(elementId, { layout: normalizeFreeformLayout(layout) });
    },
    [patchElement]
  );

  const patchElementContent = useCallback(
    (elementId: string, patch: Partial<FreeformElement>) => {
      patchElement(elementId, patch);
    },
    [patchElement]
  );

  const openImagePicker = useCallback(
    (element: FreeformImageElement) => {
      if (!media || !storeId || !onUpdateSection) return;
      media.openMediaPicker({
        storeId,
        assetKey: `${section.id}-${element.id}-image`,
        title: 'Choose image',
        onSelect: (url) =>
          patchElementContent(element.id, {
            content: { ...element.content, url },
          } as Partial<FreeformElement>),
      });
    },
    [media, storeId, onUpdateSection, section.id, patchElementContent]
  );

  useEffect(() => {
    if (!editMode) setLiveLayout(null);
  }, [editMode]);

  useEffect(() => {
    if (!editMode || !selectedElementId || !media || !storeId) return;
    const el = elements.find((e) => e.id === selectedElementId);
    if (el?.type !== 'image' || el.content.url) return;
    if (pickerOpenedForRef.current.has(el.id)) return;
    pickerOpenedForRef.current.add(el.id);
    openImagePicker(el);
  }, [editMode, selectedElementId, elements, media, storeId, openImagePicker]);

  const beginMove = (e: React.PointerEvent, element: FreeformElement) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectElement?.(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...element.layout };

    const onMove = (ev: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      const next = normalizeFreeformLayout({
        ...origin,
        x: origin.x + dx,
        y: origin.y + dy,
      });
      setLiveLayout({ elementId: element.id, layout: next });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        commitLayout(element.id, {
          ...origin,
          x: origin.x + dx,
          y: origin.y + dy,
        });
      }
      setLiveLayout(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginResize = (e: React.PointerEvent, element: FreeformElement) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectElement?.(element.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...element.layout };

    const onMove = (ev: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dw = ((ev.clientX - startX) / rect.width) * 100;
      const dh = ((ev.clientY - startY) / rect.height) * 100;
      const next = normalizeFreeformLayout({
        ...origin,
        width: origin.width + dw,
        height: origin.height + dh,
      });
      setLiveLayout({ elementId: element.id, layout: next });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dw = ((ev.clientX - startX) / rect.width) * 100;
        const dh = ((ev.clientY - startY) / rect.height) * 100;
        commitLayout(element.id, {
          ...origin,
          width: origin.width + dw,
          height: origin.height + dh,
        });
      }
      setLiveLayout(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const selectElement = (e: React.MouseEvent, elementId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    onSelectElement?.(elementId);
  };

  const renderLayerHandles = (element: FreeformElement, isSelected: boolean) => {
    if (!editMode || !isSelected) return null;
    return (
      <>
        <button
          type="button"
          className="freeform-element__move"
          title="Drag to move"
          aria-label={`Move ${LAYER_LABELS[element.type]}`}
          onPointerDown={(e) => beginMove(e, element)}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className="freeform-resize-handle"
          title="Resize"
          onPointerDown={(e) => beginResize(e, element)}
        />
      </>
    );
  };

  const renderElement = (element: FreeformElement) => {
    const isSelected = editMode && selectedElementId === element.id;
    const isActive = liveLayout?.elementId === element.id;
    const layout = isActive && liveLayout ? liveLayout.layout : element.layout;
    const style = layoutToStyle(layout);

    const shellClass = `freeform-element freeform-element--${element.type}${
      isSelected ? ' is-selected' : ''
    }${isActive ? ' is-dragging' : ''}${editMode ? ' is-editable' : ''}`;

    if (element.type === 'image') {
      const rounded = element.content.rounded !== false;
      const shadow = element.content.shadow === true;
      const imgStyle: React.CSSProperties = {
        objectFit: element.content.objectFit || 'cover',
        borderRadius: rounded ? '8px' : 0,
        boxShadow: shadow ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
      };

      return (
        <div
          key={element.id}
          className={shellClass}
          style={style}
          onClick={(e) => selectElement(e, element.id)}
          onPointerDown={(e) => {
            if (!editMode || !element.content.url) return;
            const target = e.target as HTMLElement;
            if (target.closest('.freeform-resize-handle, .freeform-element__move')) return;
            beginMove(e, element);
          }}
        >
          <div className="freeform-image-box">
            {element.content.url ? (
              <figure className="freeform-image-box__figure">
                <img
                  src={element.content.url}
                  alt={element.content.alt || ''}
                  style={imgStyle}
                  draggable={false}
                  onDoubleClick={
                    editMode && media
                      ? (e) => {
                          e.stopPropagation();
                          openImagePicker(element);
                        }
                      : undefined
                  }
                  title={editMode ? 'Drag to move · Double-click to change image' : undefined}
                />
              </figure>
            ) : (
              <button
                type="button"
                className="image-section-placeholder freeform-image-box__placeholder"
                disabled={!editMode || !media}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editMode) openImagePicker(element);
                }}
              >
                {editMode ? '+ Add image' : 'Image'}
              </button>
            )}
          </div>
          {renderLayerHandles(element, isSelected)}
        </div>
      );
    }

    if (element.type === 'text') {
      const textStyle: React.CSSProperties = {
        fontSize: element.content.fontSize ? `${element.content.fontSize}px` : undefined,
        color: element.content.color || theme?.textColor || '#111827',
        fontWeight: element.content.fontWeight || 'normal',
        textAlign: element.content.textAlign || 'left',
      };
      return (
        <div
          key={element.id}
          className={shellClass}
          style={style}
          onClick={(e) => selectElement(e, element.id)}
        >
          {editMode && onUpdateSection ? (
            <BuilderInlineEditable
              tag="div"
              className="freeform-text-body"
              style={textStyle}
              value={element.content.text}
              onChange={(text) =>
                patchElementContent(element.id, {
                  content: { ...element.content, text },
                } as Partial<FreeformElement>)
              }
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="freeform-text-body" style={textStyle}>
              <BuilderHtmlContent html={element.content.text} tag="span" />
            </div>
          )}
          {renderLayerHandles(element, isSelected)}
        </div>
      );
    }

    const buttonStyles = getBuilderButtonStyles(element.content, theme || {});
    return (
      <div
        key={element.id}
        className={shellClass}
        style={style}
        onClick={(e) => selectElement(e, element.id)}
      >
        <div className="freeform-button-wrap">
          {editMode && onUpdateSection ? (
            <BuilderInlineEditable
              tag="span"
              className={`${SITES_THEME_BUTTON_CLASS} freeform-button-preview`}
              style={buttonStyles}
              value={element.content.label}
              onChange={(label) =>
                patchElementContent(element.id, {
                  content: { ...element.content, label },
                } as Partial<FreeformElement>)
              }
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <StorefrontLink
              href={element.content.href}
              preview={Boolean(onActivate)}
              className={SITES_THEME_BUTTON_CLASS}
              style={buttonStyles}
            >
              <BuilderHtmlContent html={element.content.label} tag="span" />
            </StorefrontLink>
          )}
        </div>
        {renderLayerHandles(element, isSelected)}
      </div>
    );
  };

  /** Builder only: section on canvas but not selected yet */
  const showBuilderIdleChrome = !editMode && Boolean(onActivate);

  return (
    <div
      className={`freeform-section${
        editMode ? ' freeform-section--edit' : showBuilderIdleChrome ? ' freeform-section--idle' : ''
      }`}
      style={{ background: section.settings.backgroundColor || '#ffffff' }}
    >
      <div
        ref={canvasRef}
        className={`freeform-canvas${editMode ? ' freeform-canvas--edit' : ''}`}
        style={{ minHeight: section.settings.minHeightPx || 420 }}
        onClick={(e) => {
          if (editMode) {
            e.stopPropagation();
            onSelectElement?.(null);
          }
        }}
      >
        {showBuilderIdleChrome && (
          <>
            <button
              type="button"
              className="freeform-canvas__activate"
              aria-label="Edit design canvas"
              onClick={(e) => {
                e.stopPropagation();
                onActivate?.();
              }}
            />
            <div className="freeform-canvas__tap-hint" aria-hidden>
              Click to edit canvas
            </div>
          </>
        )}

        {elements.length === 0 && editMode && (
          <div className="freeform-canvas__empty">
            <p className="freeform-canvas__empty-title">Start your layout</p>
            <p className="freeform-canvas__empty-sub">Add a layer, then drag and resize on the canvas</p>
            <div className="freeform-canvas__empty-actions">
              {(['text', 'image', 'button'] as const).map((type) => {
                const Icon = LAYER_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    className="freeform-canvas__empty-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddLayer?.(type);
                    }}
                  >
                    <Icon aria-hidden />
                    {LAYER_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {elements.map(renderElement)}
      </div>
    </div>
  );
}
