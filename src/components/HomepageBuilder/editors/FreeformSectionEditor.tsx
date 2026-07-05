import { useEffect, useRef } from 'react';
import { FiChevronDown, FiChevronUp, FiImage, FiSquare, FiTrash2, FiType } from 'react-icons/fi';
import type { FreeformElement, FreeformElementType, FreeformSection } from '../../../types/homepage';
import {
  createFreeformElement,
  normalizeFreeformElementsList,
  normalizeFreeformLayout,
  removeFreeformElement,
  sortFreeformElements,
} from '../../../utils/freeformElements';
import { sanitizeStoreLinkHref } from '../../../utils/storefrontHref';
import { useBuilderMedia } from '../media/BuilderMediaContext';
import BuilderRichTextEditor from '../BuilderRichTextEditor';
import ButtonStyleControls from './ButtonStyleControls';
import MediaPickerButton from '../media/MediaPickerButton';
import StoreLinkPicker from '../StoreLinkPicker';
import SidebarDropdownField from '../SidebarDropdownField';

interface FreeformSectionEditorProps {
  section: FreeformSection & { id: string };
  storeId: string;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdate: (updates: Partial<FreeformSection>) => void;
}

export default function FreeformSectionEditor({
  section,
  storeId,
  selectedElementId,
  onSelectElement,
  onUpdate,
}: FreeformSectionEditorProps) {
  const { openMediaPicker } = useBuilderMedia();
  const pickerOpenedForRef = useRef<Set<string>>(new Set());

  const elements = sortFreeformElements(normalizeFreeformElementsList(section.content?.elements));
  const selected = elements.find((el) => el.id === selectedElementId) || null;

  const layerIcons: Record<FreeformElementType, React.ComponentType<{ className?: string }>> = {
    text: FiType,
    image: FiImage,
    button: FiSquare,
  };

  const setElements = (next: FreeformElement[]) => {
    onUpdate({ content: { elements: next } });
  };

  const openImagePickerFor = (elementId: string, current?: FreeformElement) => {
    const el = current ?? elements.find((e) => e.id === elementId);
    if (!el || el.type !== 'image') return;
    openMediaPicker({
      storeId,
      assetKey: `${section.id}-${elementId}-image`,
      title: 'Choose image',
      onSelect: (url) =>
        updateElement(elementId, {
          content: { ...el.content, url },
        } as Partial<FreeformElement>),
    });
  };

  const addElement = (type: FreeformElementType) => {
    const maxZ = elements.reduce((m, el) => Math.max(m, el.layout.zIndex ?? 0), 0);
    const el = createFreeformElement(type, maxZ + 1);
    setElements([...elements, el]);
    onSelectElement(el.id);
    if (type === 'image') {
      pickerOpenedForRef.current.delete(el.id);
    }
  };

  const updateElement = (id: string, patch: Partial<FreeformElement>) => {
    onUpdate({
      content: {
        elements: elements.map((el) => (el.id === id ? ({ ...el, ...patch } as FreeformElement) : el)),
      },
    });
  };

  const updateLayout = (id: string, layoutPatch: Partial<FreeformElement['layout']>) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    updateElement(id, { layout: normalizeFreeformLayout({ ...el.layout, ...layoutPatch }) });
  };

  const deleteElement = (id: string) => {
    onUpdate(removeFreeformElement(section, id));
    pickerOpenedForRef.current.delete(id);
    if (selectedElementId === id) onSelectElement(null);
  };

  const nudgeZ = (id: string, delta: number) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    updateLayout(id, { zIndex: (el.layout.zIndex ?? 0) + delta });
  };

  useEffect(() => {
    if (!selected || selected.type !== 'image') return;
    if (selected.content.url) return;
    if (pickerOpenedForRef.current.has(selected.id)) return;
    pickerOpenedForRef.current.add(selected.id);
    openImagePickerFor(selected.id, selected);
  }, [selected]);

  return (
    <div className="freeform-editor">
      <div className="panel-section freeform-editor__section">
        <span className="panel-section-title">Canvas</span>
        <div className="sidebar-field-row">
          <div className="sidebar-field">
            <label className="panel-label">Height (px)</label>
            <input
              type="number"
              className="panel-input"
              min={200}
              max={1200}
              value={section.settings.minHeightPx ?? 420}
              onChange={(e) =>
                onUpdate({
                  settings: {
                    ...section.settings,
                    minHeightPx: Math.min(1200, Math.max(200, Number(e.target.value) || 420)),
                  },
                })
              }
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Background</label>
            <input
              type="color"
              className="panel-input panel-input--color"
              value={section.settings.backgroundColor || '#ffffff'}
              onChange={(e) =>
                onUpdate({ settings: { ...section.settings, backgroundColor: e.target.value } })
              }
            />
          </div>
        </div>
      </div>

      <div className="panel-section freeform-editor__section">
        <span className="panel-section-title">Add layer</span>
        <div className="freeform-editor__add-row">
          {(['text', 'image', 'button'] as const).map((type) => {
            const Icon = layerIcons[type];
            return (
              <button key={type} type="button" className="freeform-editor__add-btn" onClick={() => addElement(type)}>
                <Icon aria-hidden />
                <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {elements.length > 0 && (
        <div className="panel-section freeform-editor__section">
          <span className="panel-section-title">Layers</span>
          <ul className="freeform-layer-list">
            {[...elements].reverse().map((el) => {
              const Icon = layerIcons[el.type];
              const label =
                el.type === 'text'
                  ? (el.content.text || 'Text').slice(0, 28)
                  : el.type === 'image'
                    ? el.content.url
                      ? 'Image'
                      : 'Image (empty)'
                    : el.content.label || 'Button';
              return (
                <li key={el.id}>
                  <button
                    type="button"
                    className={`freeform-layer-item${selectedElementId === el.id ? ' active' : ''}`}
                    onClick={() => onSelectElement(el.id)}
                  >
                    <span className="freeform-layer-item__left">
                      <Icon className="freeform-layer-item__icon" aria-hidden />
                      <span className="freeform-layer-item__type">{label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selected && (
        <div className="panel-section freeform-editor__section freeform-element-props">
          <span className="panel-section-title">
            {selected.type === 'image' ? 'Image box' : `${selected.type.charAt(0).toUpperCase() + selected.type.slice(1)} layer`}
          </span>

          <div className="freeform-layer-actions">
            <button type="button" className="freeform-icon-btn" title="Bring forward" onClick={() => nudgeZ(selected.id, 1)}>
              <FiChevronUp aria-hidden />
            </button>
            <button type="button" className="freeform-icon-btn" title="Send backward" onClick={() => nudgeZ(selected.id, -1)}>
              <FiChevronDown aria-hidden />
            </button>
            <button type="button" className="freeform-icon-btn freeform-icon-btn--danger" onClick={() => deleteElement(selected.id)}>
              <FiTrash2 aria-hidden />
            </button>
          </div>

          {selected.type === 'image' && (
            <>
              <div className="sidebar-field">
                <label className="panel-label">Image</label>
                <MediaPickerButton
                  storeId={storeId}
                  assetKey={`${section.id}-${selected.id}-image`}
                  label="Choose image"
                  currentUrl={selected.content.url}
                  className="btn-secondary freeform-image-picker-btn"
                  onUrl={(url) =>
                    updateElement(selected.id, {
                      content: { ...selected.content, url },
                    } as Partial<FreeformElement>)
                  }
                />
              </div>
              <div className="sidebar-field">
                <label className="panel-label">Alt text</label>
                <input
                  type="text"
                  className="panel-input"
                  value={selected.content.alt || ''}
                  placeholder="Describe the image"
                  onChange={(e) =>
                    updateElement(selected.id, {
                      content: { ...selected.content, alt: e.target.value },
                    } as Partial<FreeformElement>)
                  }
                />
              </div>
              <div className="sidebar-field">
                <label className="panel-label">Fit</label>
                <SidebarDropdownField
                  ariaLabel="Image fit"
                  value={selected.content.objectFit || 'cover'}
                  options={[
                    { value: 'cover', label: 'Cover' },
                    { value: 'contain', label: 'Contain' },
                    { value: 'fill', label: 'Fill' },
                  ]}
                  onChange={(next) =>
                    updateElement(selected.id, {
                      content: {
                        ...selected.content,
                        objectFit: next as 'cover' | 'contain' | 'fill',
                      },
                    } as Partial<FreeformElement>)
                  }
                />
              </div>
              <div className="sidebar-field-row freeform-editor__toggles">
                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.content.rounded !== false}
                    onChange={(e) =>
                      updateElement(selected.id, {
                        content: { ...selected.content, rounded: e.target.checked },
                      } as Partial<FreeformElement>)
                    }
                  />
                  Rounded corners
                </label>
                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.content.shadow === true}
                    onChange={(e) =>
                      updateElement(selected.id, {
                        content: { ...selected.content, shadow: e.target.checked },
                      } as Partial<FreeformElement>)
                    }
                  />
                  Drop shadow
                </label>
              </div>
            </>
          )}

          {selected.type === 'text' && (
            <>
              <BuilderRichTextEditor
                label="Text"
                value={selected.content.text}
                onChange={(text) =>
                  updateElement(selected.id, {
                    content: { ...selected.content, text },
                  } as Partial<FreeformElement>)
                }
                minHeight={100}
              />
              <div className="sidebar-field-row">
                <div className="sidebar-field">
                  <label className="panel-label">Size (px)</label>
                  <input
                    type="number"
                    className="panel-input"
                    value={selected.content.fontSize ?? 24}
                    onChange={(e) =>
                      updateElement(selected.id, {
                        content: { ...selected.content, fontSize: Number(e.target.value) || 16 },
                      } as Partial<FreeformElement>)
                    }
                  />
                </div>
                <div className="sidebar-field">
                  <label className="panel-label">Color</label>
                  <input
                    type="color"
                    className="panel-input panel-input--color"
                    value={selected.content.color || '#111827'}
                    onChange={(e) =>
                      updateElement(selected.id, {
                        content: { ...selected.content, color: e.target.value },
                      } as Partial<FreeformElement>)
                    }
                  />
                </div>
              </div>
              <div className="sidebar-field">
                <label className="panel-label">Align</label>
                <SidebarDropdownField
                  ariaLabel="Text align"
                  value={selected.content.textAlign || 'left'}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                  onChange={(next) =>
                    updateElement(selected.id, {
                      content: {
                        ...selected.content,
                        textAlign: next as 'left' | 'center' | 'right',
                      },
                    } as Partial<FreeformElement>)
                  }
                />
              </div>
            </>
          )}

          {selected.type === 'button' && (
            <>
              <div className="sidebar-field">
                <label className="panel-label">Label</label>
                <input
                  type="text"
                  className="panel-input"
                  value={selected.content.label}
                  onChange={(e) =>
                    updateElement(selected.id, {
                      content: { ...selected.content, label: e.target.value },
                    } as Partial<FreeformElement>)
                  }
                />
              </div>
              <StoreLinkPicker
                value={selected.content.href}
                onChange={(href) =>
                  updateElement(selected.id, {
                    content: { ...selected.content, href: sanitizeStoreLinkHref(href) },
                  } as Partial<FreeformElement>)
                }
              />
              <ButtonStyleControls
                settings={selected.content}
                onChange={(patch) =>
                  updateElement(selected.id, {
                    content: { ...selected.content, ...patch },
                  } as Partial<FreeformElement>)
                }
              />
            </>
          )}

          <details className="freeform-editor__layout-details">
            <summary className="freeform-editor__layout-summary">Position & size</summary>
            <div className="sidebar-field-row">
              <div className="sidebar-field">
                <label className="panel-label">X %</label>
                <input
                  type="number"
                  className="panel-input"
                  value={Math.round(selected.layout.x)}
                  onChange={(e) => updateLayout(selected.id, { x: Number(e.target.value) })}
                />
              </div>
              <div className="sidebar-field">
                <label className="panel-label">Y %</label>
                <input
                  type="number"
                  className="panel-input"
                  value={Math.round(selected.layout.y)}
                  onChange={(e) => updateLayout(selected.id, { y: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="sidebar-field-row">
              <div className="sidebar-field">
                <label className="panel-label">Width %</label>
                <input
                  type="number"
                  className="panel-input"
                  value={Math.round(selected.layout.width)}
                  onChange={(e) => updateLayout(selected.id, { width: Number(e.target.value) })}
                />
              </div>
              <div className="sidebar-field">
                <label className="panel-label">Height %</label>
                <input
                  type="number"
                  className="panel-input"
                  value={Math.round(selected.layout.height)}
                  onChange={(e) => updateLayout(selected.id, { height: Number(e.target.value) })}
                />
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
