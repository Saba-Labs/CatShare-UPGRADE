import { useState } from 'react';
import { FiLayout, FiPlus } from 'react-icons/fi';
import { WEBSITE_TEMPLATES, type WebsiteTemplateId } from '../../config/websiteTemplates';

interface TemplateGalleryProps {
  variant?: 'full' | 'compact';
  onApply: (id: WebsiteTemplateId) => void;
  onStartBlank?: () => void;
}

export default function TemplateGallery({ variant = 'full', onApply, onStartBlank }: TemplateGalleryProps) {
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});
  const isFull = variant === 'full';

  return (
    <div className={`template-gallery template-gallery-${variant}`}>
      {isFull && (
        <header className="template-picker-hero">
          <p className="template-picker-eyebrow">Choose your starting point</p>
          <h2 className="template-picker-title">Pick a template for your store</h2>
          <p className="template-picker-sub">
            Your header, shop, checkout, and footer styling come from the template you select. You can
            customize everything after.
          </p>
        </header>
      )}

      {!isFull && (
        <div className="template-gallery-head">
          <h3 className="template-gallery-title">Templates</h3>
          <p className="template-gallery-sub">One look for your whole site.</p>
        </div>
      )}

      <div className={`template-gallery-grid${isFull ? ' template-gallery-grid--picker' : ''}`}>
        {WEBSITE_TEMPLATES.map((tpl, index) => (
          <article key={tpl.id} className="template-card">
            {isFull && tpl.id === 'studio-commerce' ? (
              <span className="template-card-badge">New</span>
            ) : isFull && index === 1 ? (
              <span className="template-card-badge">Popular</span>
            ) : null}
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
              <div className="template-card-preview-shade" aria-hidden />
            </div>
            <div className="template-card-body">
              <div className="template-card-headline">
                <span className="template-card-name">{tpl.name}</span>
                <span className="template-card-tag">{tpl.tagline}</span>
              </div>
              {isFull && <p className="template-card-desc">{tpl.description}</p>}
              <div className="template-swatches" aria-label="Color palette">
                {tpl.palette.map((color) => (
                  <span key={color} className="template-swatch" style={{ background: color }} title={color} />
                ))}
              </div>
              <button
                type="button"
                className="template-apply-btn"
                onClick={() => onApply(tpl.id)}
                title={`Use ${tpl.name}`}
              >
                {isFull ? 'Use this template' : 'Use'}
              </button>
            </div>
          </article>
        ))}

        {onStartBlank && isFull && (
          <article className="template-card template-card--blank">
            <div className="template-card-preview template-card-preview--blank">
              <div className="template-blank-icon-wrap">
                <FiPlus className="template-blank-icon" aria-hidden />
              </div>
              <div className="template-card-preview-shade template-card-preview-shade--muted" aria-hidden />
            </div>
            <div className="template-card-body">
              <div className="template-card-headline">
                <span className="template-card-name">Start from blank</span>
                <span className="template-card-tag">Build your own layout</span>
              </div>
              <p className="template-card-desc">
                Skip presets and add blocks one by one. Footer and theme use simple defaults until you
                style them.
              </p>
              <div className="template-swatches template-swatches--placeholder" aria-hidden>
                <span className="template-swatch template-swatch--ghost" />
                <span className="template-swatch template-swatch--ghost" />
                <span className="template-swatch template-swatch--ghost" />
                <span className="template-swatch template-swatch--ghost" />
              </div>
              <button type="button" className="template-apply-btn template-apply-btn--outline" onClick={onStartBlank}>
                <FiLayout aria-hidden />
                Start from blank
              </button>
            </div>
          </article>
        )}
      </div>

      {onStartBlank && !isFull && (
        <button type="button" className="template-start-blank" onClick={onStartBlank}>
          Start from blank
        </button>
      )}
    </div>
  );
}
