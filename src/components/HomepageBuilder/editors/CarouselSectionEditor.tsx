import React from 'react';
import { CarouselSection } from '../../../types/homepage';
import { createCarouselImagesFromUrls } from '../../../utils/sectionMedia';
import { useBuilderMedia } from '../media/BuilderMediaContext';
import SidebarDropdownField from '../SidebarDropdownField';

interface CarouselSectionEditorProps {
  section: CarouselSection & { id: string };
  storeId: string;
  onUpdate: (updates: Partial<CarouselSection>) => void;
}

export default function CarouselSectionEditor({ section, storeId, onUpdate }: CarouselSectionEditorProps) {
  const { openMediaPicker } = useBuilderMedia();

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

  const handleRemoveImage = (imageId: string) => {
    onUpdate({
      content: {
        images: section.content.images.filter((img) => img.id !== imageId),
      },
    });
  };

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Images ({section.content.images.length})</label>
        <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={addImagesFromLibrary}>
          + Add images
        </button>

        <div style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}>
          {section.content.images.map((img) => (
            <div key={img.id} className="carousel-editor-thumb-row">
              <img src={img.url} alt={img.title} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.75rem' }}>{img.title || 'Slide'}</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => handleRemoveImage(img.id)} style={{ color: '#dc2626' }}>
                ✕
              </button>
            </div>
          ))}
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
    </>
  );
}
