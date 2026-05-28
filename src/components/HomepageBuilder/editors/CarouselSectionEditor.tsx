import React from 'react';
import { CarouselSection } from '../../../types/homepage';
import { useBuilderMedia } from '../media/BuilderMediaContext';

interface CarouselSectionEditorProps {
  section: CarouselSection & { id: string };
  storeId: string;
  onUpdate: (updates: Partial<CarouselSection>) => void;
}

export default function CarouselSectionEditor({ section, storeId, onUpdate }: CarouselSectionEditorProps) {
  const { openMediaPicker } = useBuilderMedia();

  const addImageFromLibrary = () => {
    openMediaPicker({
      storeId,
      assetKey: `${section.id}-slide-${Date.now()}`,
      title: 'Add carousel image',
      onSelect: (url) => {
        onUpdate({
          content: {
            images: [
              ...section.content.images,
              {
                id: `img-${Date.now()}`,
                url,
                title: '',
                caption: '',
              },
            ],
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
        <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={addImageFromLibrary}>
          + Add image
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
        <select
          className="panel-select"
          value={section.settings.height}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, height: e.target.value as CarouselSection['settings']['height'] },
            })
          }
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Aspect Ratio</label>
        <select
          className="panel-select"
          value={section.settings.aspectRatio}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, aspectRatio: e.target.value as CarouselSection['settings']['aspectRatio'] },
            })
          }
        >
          <option value="16:9">16:9 Widescreen</option>
          <option value="4:3">4:3 Standard</option>
          <option value="square">Square</option>
        </select>
      </div>

      <div className="panel-section">
        <label className="panel-label">Animation</label>
        <select
          className="panel-select"
          value={section.settings.animation}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, animation: e.target.value as CarouselSection['settings']['animation'] },
            })
          }
        >
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
        </select>
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
            onChange={(e) =>
              onUpdate({
                settings: { ...section.settings, interval: parseInt(e.target.value, 10) },
              })
            }
            min="1000"
            step="1000"
          />
        </div>
      )}

      <div className="panel-section">
        <label className="panel-label">Navigation</label>
        <select
          className="panel-select"
          value={section.settings.navigation}
          onChange={(e) =>
            onUpdate({
              settings: { ...section.settings, navigation: e.target.value as CarouselSection['settings']['navigation'] },
            })
          }
        >
          <option value="none">None</option>
          <option value="dots">Dots</option>
          <option value="arrows">Arrows</option>
          <option value="both">Dots + Arrows</option>
        </select>
      </div>
    </>
  );
}
