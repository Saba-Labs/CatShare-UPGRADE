import React from 'react';
import { HomepageSection } from '../../../types/homepage';

interface GenericSectionEditorProps {
  section: HomepageSection & { id: string };
  storeId: string;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function GenericSectionEditor({ section, onUpdate }: GenericSectionEditorProps) {
  const renderEditor = () => {
    switch (section.type) {
      case 'image':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label">Image URL</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.url || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, url: e.target.value },
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Alt Text</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.alt || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, alt: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Width</label>
              <select
                className="panel-select"
                value={(section as any).settings.width}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, width: e.target.value },
                  })
                }
              >
                <option value="small">30%</option>
                <option value="medium">50%</option>
                <option value="large">80%</option>
                <option value="full">100%</option>
              </select>
            </div>

            <div className="panel-section">
              <label className="panel-checkbox">
                <input
                  type="checkbox"
                  checked={(section as any).settings.rounded}
                  onChange={(e) =>
                    onUpdate({
                      settings: { ...(section as any).settings, rounded: e.target.checked },
                    })
                  }
                />
                <span>Rounded Corners</span>
              </label>
            </div>

            <div className="panel-section">
              <label className="panel-checkbox">
                <input
                  type="checkbox"
                  checked={(section as any).settings.shadow}
                  onChange={(e) =>
                    onUpdate({
                      settings: { ...(section as any).settings, shadow: e.target.checked },
                    })
                  }
                />
                <span>Drop Shadow</span>
              </label>
            </div>
          </>
        );

      case 'banner':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label">Title</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.title}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, title: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Subtitle</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.subtitle || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, subtitle: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Text</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.buttonText || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, buttonText: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Link</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.buttonLink || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, buttonLink: e.target.value },
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Height</label>
              <select
                className="panel-select"
                value={(section as any).settings.height}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, height: e.target.value },
                  })
                }
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="panel-section">
              <label className="panel-label">Background Color</label>
              <input
                type="color"
                className="panel-input"
                value={(section as any).settings.backgroundColor || '#2563eb'}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, backgroundColor: e.target.value },
                  })
                }
              />
            </div>
          </>
        );

      case 'cta':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label">Title</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.title}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, title: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Description</label>
              <textarea
                className="panel-input"
                value={(section as any).content.description || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, description: e.target.value },
                  })
                }
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Text</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.buttonText}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, buttonText: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Link</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.buttonLink}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, buttonLink: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Color</label>
              <input
                type="color"
                className="panel-input"
                value={(section as any).settings.buttonColor || '#2563eb'}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, buttonColor: e.target.value },
                  })
                }
              />
            </div>
          </>
        );

      case 'announcement':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label">Message</label>
              <textarea
                className="panel-input"
                value={(section as any).content.message}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, message: e.target.value },
                  })
                }
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Icon</label>
              <select
                className="panel-select"
                value={(section as any).settings.icon}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, icon: e.target.value },
                  })
                }
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
                <option value="none">None</option>
              </select>
            </div>

            <div className="panel-section">
              <label className="panel-label">Background Color</label>
              <input
                type="color"
                className="panel-input"
                value={(section as any).settings.backgroundColor || '#fef3c7'}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, backgroundColor: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Text Color</label>
              <input
                type="color"
                className="panel-input"
                value={(section as any).settings.textColor || '#92400e'}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, textColor: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-checkbox">
                <input
                  type="checkbox"
                  checked={(section as any).settings.dismissible}
                  onChange={(e) =>
                    onUpdate({
                      settings: { ...(section as any).settings, dismissible: e.target.checked },
                    })
                  }
                />
                <span>Dismissible</span>
              </label>
            </div>
          </>
        );

      case 'feature-card':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label">Image URL</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.imageUrl || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, imageUrl: e.target.value },
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Title</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.title}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, title: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Description</label>
              <textarea
                className="panel-input"
                value={(section as any).content.description}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, description: e.target.value },
                  })
                }
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Text</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.buttonText || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, buttonText: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Button Link</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.buttonLink || ''}
                onChange={(e) =>
                  onUpdate({
                    content: { ...(section as any).content, buttonLink: e.target.value },
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Layout</label>
              <select
                className="panel-select"
                value={(section as any).settings.layout}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, layout: e.target.value },
                  })
                }
              >
                <option value="image-left">Image Left</option>
                <option value="image-right">Image Right</option>
              </select>
            </div>
          </>
        );

      case 'two-column-content':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label" style={{ fontWeight: 'bold' }}>
                Left Column
              </label>
            </div>

            <div className="panel-section">
              <label className="panel-label">Image URL</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.leftContent.imageUrl || ''}
                onChange={(e) =>
                  onUpdate({
                    content: {
                      ...(section as any).content,
                      leftContent: { ...(section as any).content.leftContent, imageUrl: e.target.value },
                    },
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Title</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.leftContent.title}
                onChange={(e) =>
                  onUpdate({
                    content: {
                      ...(section as any).content,
                      leftContent: { ...(section as any).content.leftContent, title: e.target.value },
                    },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Description</label>
              <textarea
                className="panel-input"
                value={(section as any).content.leftContent.description}
                onChange={(e) =>
                  onUpdate({
                    content: {
                      ...(section as any).content,
                      leftContent: { ...(section as any).content.leftContent, description: e.target.value },
                    },
                  })
                }
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="panel-section">
              <label className="panel-label" style={{ fontWeight: 'bold' }}>
                Right Column
              </label>
            </div>

            <div className="panel-section">
              <label className="panel-label">Image URL</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.rightContent.imageUrl || ''}
                onChange={(e) =>
                  onUpdate({
                    content: {
                      ...(section as any).content,
                      rightContent: { ...(section as any).content.rightContent, imageUrl: e.target.value },
                    },
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Title</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).content.rightContent.title}
                onChange={(e) =>
                  onUpdate({
                    content: {
                      ...(section as any).content,
                      rightContent: { ...(section as any).content.rightContent, title: e.target.value },
                    },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Description</label>
              <textarea
                className="panel-input"
                value={(section as any).content.rightContent.description}
                onChange={(e) =>
                  onUpdate({
                    content: {
                      ...(section as any).content,
                      rightContent: { ...(section as any).content.rightContent, description: e.target.value },
                    },
                  })
                }
                style={{ minHeight: '60px' }}
              />
            </div>
          </>
        );

      case 'content-grid':
        return (
          <>
            <div className="panel-section">
              <label className="panel-label">Grid Title</label>
              <input
                type="text"
                className="panel-input"
                value={(section as any).settings.title || ''}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, title: e.target.value },
                  })
                }
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">Columns</label>
              <select
                className="panel-select"
                value={(section as any).settings.columns}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, columns: parseInt(e.target.value) },
                  })
                }
              >
                <option value="2">2 Columns</option>
                <option value="3">3 Columns</option>
                <option value="4">4 Columns</option>
              </select>
            </div>

            <div style={{ padding: '12px', background: '#e0e7ff', borderRadius: '6px', fontSize: '0.875rem', color: '#3730a3' }}>
              <p style={{ margin: 0 }}>
                <strong>Tip:</strong> Edit grid items directly on the canvas by clicking them.
              </p>
            </div>
          </>
        );

      case 'featured-products':
      case 'category-showcase':
      case 'product-grid':
      case 'video':
      case 'testimonials':
      case 'footer':
      default:
        return (
          <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '6px', fontSize: '0.875rem', color: '#6b7280' }}>
            <p style={{ margin: 0 }}>Advanced editor coming soon for {section.type}</p>
          </div>
        );
    }
  };

  return <>{renderEditor()}</>;
}
