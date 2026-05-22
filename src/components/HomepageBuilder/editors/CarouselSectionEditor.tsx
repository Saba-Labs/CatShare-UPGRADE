import React from 'react';
import { CarouselSection } from '../../../types/homepage';

interface CarouselSectionEditorProps {
  section: CarouselSection & { id: string };
  onUpdate: (updates: Partial<CarouselSection>) => void;
}

export default function CarouselSectionEditor({ section, onUpdate }: CarouselSectionEditorProps) {
  const handleAddImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
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
    }
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
        <button
          className="btn-secondary"
          style={{ width: '100%' }}
          onClick={handleAddImage}
        >
          + Add Image
        </button>

        <div style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}>
          {section.content.images.map((img) => (
            <div
              key={img.id}
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '8px',
                padding: '8px',
                background: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '0.75rem',
              }}
            >
              <img
                src={img.url}
                alt={img.title}
                style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {img.title || 'Image'}
                </p>
              </div>
              <button
                className="btn-icon"
                onClick={() => handleRemoveImage(img.id)}
                style={{ color: '#dc2626' }}
              >
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
              settings: { ...section.settings, height: e.target.value as any },
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
              settings: { ...section.settings, aspectRatio: e.target.value as any },
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
              settings: { ...section.settings, animation: e.target.value as any },
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
                settings: { ...section.settings, interval: parseInt(e.target.value) },
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
              settings: { ...section.settings, navigation: e.target.value as any },
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
