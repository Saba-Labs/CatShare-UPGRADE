import React from 'react';
import { useState } from 'react';
import type { CarouselImage, CarouselSection, WebsiteModeConfig } from '../../../types/homepage';
import { createCarouselImagesFromUrls } from '../../../utils/sectionMedia';
import { useBuilderMedia } from '../media/BuilderMediaContext';
import StoreLinkPicker from '../StoreLinkPicker';
import SidebarDropdownField from '../SidebarDropdownField';
import ConfirmDialog from '../../../pages/store/components/ConfirmDialog';

interface CarouselSectionEditorProps {
  section: CarouselSection & { id: string };
  storeId: string;
  websiteConfig?: WebsiteModeConfig;
  onUpdate: (updates: Partial<CarouselSection>) => void;
}

export default function CarouselSectionEditor({ section, storeId, websiteConfig, onUpdate }: CarouselSectionEditorProps) {
  const { openMediaPicker } = useBuilderMedia();
  const [expandedSlideIds, setExpandedSlideIds] = useState<Set<string>>(() => new Set());
  const [imageToRemoveId, setImageToRemoveId] = useState<string | null>(null);

  const addImagesFromLibrary = () => {
    openMediaPicker({
      storeId,
      assetKey: `${section.id}-slides`,
      title: 'Add carousel images',
      multiple: true,
      onSelectMultiple: (urls) => {
        onUpdate({
          content: {
            images: [...section.content.images, ...createCarouselImagesFromUrls(urls)],
          },
        });
      },
    });
  };

  const handleRemoveImage = (imageId: string) => setImageToRemoveId(imageId);

  const confirmRemoveImage = () => {
    if (!imageToRemoveId) return;
    onUpdate({
      content: {
        images: section.content.images.filter((img) => img.id !== imageToRemoveId),
      },
    });
    setImageToRemoveId(null);
  };

  const updateImageView = (imageId: string, patch: Partial<NonNullable<CarouselImage['imageView']>>) => {
    onUpdate({
      content: {
        images: section.content.images.map((image) => {
          if (image.id !== imageId) return image;
          const zoom = patch.zoom ?? image.imageView?.zoom ?? 1;
          const x = patch.x ?? image.imageView?.x ?? 50;
          const y = patch.y ?? image.imageView?.y ?? 50;
          return {
            ...image,
            imageView: {
              zoom,
              x: Math.max(-100, Math.min(100, x)),
              y: Math.max(-100, Math.min(100, y)),
            },
          };
        }),
      },
    });
  };

  const resetImageView = (imageId: string) =>
    onUpdate({
      content: {
        images: section.content.images.map((image) =>
          image.id === imageId ? { ...image, imageView: undefined } : image
        ),
      },
    });

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Images ({section.content.images.length})</label>
        <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={addImagesFromLibrary}>
          + Add images
        </button>

        <div style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}>
          {section.content.images.map((img) => {
            const expanded = expandedSlideIds.has(img.id);
            const linkSettingsId = `carousel-slide-link-${section.id}-${img.id}`;

            return (
              <div key={img.id} style={{ marginBottom: 8, padding: 8, background: '#f3f4f6', borderRadius: 4 }}>
                <div className="carousel-editor-thumb-row" style={{ marginBottom: 0, padding: 0, background: 'transparent' }}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={expanded ? linkSettingsId : undefined}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} link settings for ${img.title || 'slide'}`}
                    onClick={() =>
                      setExpandedSlideIds((current) => {
                        const next = new Set(current);
                        if (next.has(img.id)) next.delete(img.id);
                        else next.add(img.id);
                        return next;
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      minWidth: 0,
                      gap: 8,
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    <img src={img.url} alt={img.title} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: '0.75rem' }}>{img.title || 'Slide'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {expanded ? 'Hide link' : img.link ? 'Edit link' : 'Add link'}
                    </span>
                  </button>
                  <button type="button" className="btn-icon" onClick={() => handleRemoveImage(img.id)} style={{ color: '#dc2626' }}>
                    ✕
                  </button>
                </div>
                {expanded && (
                  <div id={linkSettingsId}>
                    <label className="panel-label" style={{ marginTop: 8 }}>
                      Image zoom
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        aria-label={`Zoom ${img.title || 'slide'} image`}
                        value={img.imageView?.zoom ?? 1}
                        onChange={(event) => updateImageView(img.id, { zoom: Number(event.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span style={{ minWidth: 36, fontSize: '0.75rem' }}>
                        {(img.imageView?.zoom ?? 1).toFixed(1)}×
                      </span>
                    </div>
                    <p className="sidebar-field-hint">Zoom in, then drag the image in the canvas to reposition it.</p>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!img.imageView}
                      onClick={() => resetImageView(img.id)}
                    >
                      Reset image view
                    </button>
                    <label className="panel-label" style={{ marginTop: 12 }}>
                      Link (optional)
                    </label>
                    <StoreLinkPicker
                      value={img.link || ''}
                      websiteConfig={websiteConfig}
                      onChange={(link) =>
                        onUpdate({
                          content: {
                            images: section.content.images.map((image) =>
                              image.id === img.id ? { ...image, link: link || undefined } : image
                            ),
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-section">
        <label className="panel-label">Height</label>
        <SidebarDropdownField
          ariaLabel="Carousel height"
          value={section.settings.height}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, height: next as CarouselSection['settings']['height'] },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Aspect Ratio</label>
        <SidebarDropdownField
          ariaLabel="Carousel aspect ratio"
          value={section.settings.aspectRatio}
          options={[
            { value: '16:9', label: '16:9 Widescreen' },
            { value: '4:3', label: '4:3 Standard' },
            { value: 'square', label: 'Square' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, aspectRatio: next as CarouselSection['settings']['aspectRatio'] },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Animation</label>
        <SidebarDropdownField
          ariaLabel="Carousel animation"
          value={section.settings.animation}
          options={[
            { value: 'fade', label: 'Fade' },
            { value: 'slide', label: 'Slide' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, animation: next as CarouselSection['settings']['animation'] },
            })
          }
        />
      </div>

      <div className="panel-section">
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={section.settings.autoPlay}
            onChange={(e) =>
              onUpdate({
                settings: { ...section.settings, autoPlay: e.target.checked },
              })
            }
          />
          <span>Auto Play</span>
        </label>
      </div>

      {section.settings.autoPlay && (
        <div className="panel-section">
          <label className="panel-label">Interval (ms)</label>
          <input
            type="number"
            className="panel-input"
            value={section.settings.interval}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              onUpdate({
                settings: {
                  ...section.settings,
                  interval: Number.isFinite(parsed) ? Math.max(1000, parsed) : section.settings.interval,
                },
              });
            }}
            min="1000"
            step="1000"
          />
        </div>
      )}

      <div className="panel-section">
        <label className="panel-label">Navigation</label>
        <SidebarDropdownField
          ariaLabel="Carousel navigation"
          value={section.settings.navigation}
          options={[
            { value: 'none', label: 'None' },
            { value: 'dots', label: 'Dots' },
            { value: 'arrows', label: 'Arrows' },
            { value: 'both', label: 'Dots + Arrows' },
          ]}
          onChange={(next) =>
            onUpdate({
              settings: { ...section.settings, navigation: next as CarouselSection['settings']['navigation'] },
            })
          }
        />
      </div>
      <ConfirmDialog
        open={imageToRemoveId !== null}
        title="Remove carousel image?"
        description="This image will be removed from the carousel."
        confirmLabel="Remove image"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmRemoveImage}
        onClose={() => setImageToRemoveId(null)}
      />
    </>
  );
}
