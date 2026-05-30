import { useState } from 'react';
import { WEBSITE_TEMPLATES, type WebsiteTemplateId } from '../../config/websiteTemplates';

interface TemplateGalleryProps {
  variant?: 'full' | 'compact';
  onApply: (id: WebsiteTemplateId) => void;
  onStartBlank?: () => void;
}

export default function TemplateGallery({ variant = 'full', onApply, onStartBlank }: TemplateGalleryProps) {
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});

  return (
    <div className={`template-gallery template-gallery-${variant}`}>
      {variant === 'full' && (
        <div className="template-gallery-head">
          <h3 className="template-gallery-title">Templates</h3>
          <p className="template-gallery-sub">
            One look for your whole site — home, shop, checkout & pages.
          </p>
        </div>
      )}

      <div className="template-gallery-grid">
        {WEBSITE_TEMPLATES.map((tpl) => (
          <div key={tpl.id} className="template-card">
            <div className="template-card-preview">
              {failedPreviews[tpl.id] ? (
                <div className="template-card-preview-fallback" style={{ background: tpl.palette[0] }}>
                  <span style={{ color: tpl.palette[3] || '#fff' }}>{tpl.name}</span>
                </div>
              ) : (
                <img
                  src={tpl.previewImage}
                  alt={`${tpl.name} preview`}
                  loading="lazy"
                  onError={() => setFailedPreviews((prev) => ({ ...prev, [tpl.id]: true }))}
                />
              )}
            </div>
            <div className="template-card-body">
              <div className="template-card-headline">
                <span className="template-card-name">{tpl.name}</span>
                <span className="template-card-tag">{tpl.tagline}</span>
              </div>
              {variant === 'full' && <p className="template-card-desc">{tpl.description}</p>}
              <div className="template-swatches">
                {tpl.palette.map((color) => (
                  <span key={color} className="template-swatch" style={{ background: color }} title={color} />
                ))}
              </div>
              <button type="button" className="template-apply-btn" onClick={() => onApply(tpl.id)} title={`Use ${tpl.name}`}>
                {variant === 'compact' ? 'Use' : 'Use this template'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {onStartBlank && (
        <button type="button" className="template-start-blank" onClick={onStartBlank}>
          Start from blank
        </button>
      )}
    </div>
  );
}
