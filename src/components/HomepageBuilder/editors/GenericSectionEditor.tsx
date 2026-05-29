import React from 'react';
import { HomepageSection, WebsiteModeConfig } from '../../../types/homepage';
import MediaPickerButton from '../media/MediaPickerButton';
import ButtonLinkField from './ButtonLinkField';
import TestimonialsSectionEditor from './TestimonialsSectionEditor';

interface GenericSectionEditorProps {
  section: HomepageSection & { id: string };
  storeId: string;
  websiteConfig?: WebsiteModeConfig;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export default function GenericSectionEditor({ section, storeId, websiteConfig, onUpdate }: GenericSectionEditorProps) {
  const renderImageUploadField = (
    fieldKey: string,
    label: string,
    currentUrl: string | undefined,
    onSetUrl: (url: string) => void
  ) => (
    <div className="panel-section">
      <label className="panel-label">{label}</label>
      <MediaPickerButton
        storeId={storeId}
        assetKey={`${section.id}-${fieldKey}`}
        label={label}
        currentUrl={currentUrl}
        onUrl={onSetUrl}
      />
    </div>
  );

  const renderEditor = () => {
    switch (section.type) {
      case 'image':
        return (
          <>
            {renderImageUploadField(
              'image.content.url',
              'Image',
              (section as any).content.url || '',
              (url) =>
                onUpdate({
                  content: { ...(section as any).content, url },
                })
            )}

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
            {renderImageUploadField(
              'banner.settings.backgroundImage',
              'Background image',
              (section as any).settings.backgroundImage || '',
              (url) =>
                onUpdate({
                  settings: { ...(section as any).settings, backgroundImage: url },
                })
            )}

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

            <ButtonLinkField
              value={(section as any).content.buttonLink || ''}
              websiteConfig={websiteConfig}
              onChange={(buttonLink) =>
                onUpdate({
                  content: { ...(section as any).content, buttonLink },
                })
              }
            />

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
              <label className="panel-label">Background color (fallback)</label>
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

            <div className="panel-section">
              <label className="panel-label">
                Overlay darkness ({Math.round(((section as any).settings.overlayOpacity ?? 0.3) * 100)}%)
              </label>
              <input
                type="range"
                className="panel-input"
                min={0}
                max={1}
                step={0.05}
                value={(section as any).settings.overlayOpacity ?? 0.3}
                onChange={(e) =>
                  onUpdate({
                    settings: { ...(section as any).settings, overlayOpacity: parseFloat(e.target.value) },
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

            <ButtonLinkField
              value={(section as any).content.buttonLink || ''}
              websiteConfig={websiteConfig}
              onChange={(buttonLink) =>
                onUpdate({
                  content: { ...(section as any).content, buttonLink },
                })
              }
            />

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
            {renderImageUploadField(
              'feature-card.content.imageUrl',
              'Image',
              (section as any).content.imageUrl || '',
              (url) =>
                onUpdate({
                  content: { ...(section as any).content, imageUrl: url },
                })
            )}

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

            <ButtonLinkField
              value={(section as any).content.buttonLink || ''}
              websiteConfig={websiteConfig}
              onChange={(buttonLink) =>
                onUpdate({
                  content: { ...(section as any).content, buttonLink },
                })
              }
            />

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

            {renderImageUploadField(
              'two-column.left.imageUrl',
              'Left Image',
              (section as any).content.leftContent.imageUrl || '',
              (url) =>
                onUpdate({
                  content: {
                    ...(section as any).content,
                    leftContent: { ...(section as any).content.leftContent, imageUrl: url },
                  },
                })
            )}

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

            {renderImageUploadField(
              'two-column.right.imageUrl',
              'Right Image',
              (section as any).content.rightContent.imageUrl || '',
              (url) =>
                onUpdate({
                  content: {
                    ...(section as any).content,
                    rightContent: { ...(section as any).content.rightContent, imageUrl: url },
                  },
                })
            )}

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

      case 'testimonials':
        return <TestimonialsSectionEditor section={section as any} onUpdate={onUpdate} />;

      case 'featured-products':
      case 'category-showcase':
      case 'product-grid':
      case 'video':
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
