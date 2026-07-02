import { useState } from 'react';
import { FiLayout, FiPlus, FiZap } from 'react-icons/fi';
import { WEBSITE_TEMPLATES, type WebsiteTemplateId } from '../../config/websiteTemplates';

interface TemplateGalleryProps {
  variant?: 'full' | 'compact';
  onApply: (id: WebsiteTemplateId) => void;
  onStartBlank?: () => void;
  onCookTheme?: () => void;
}

export default function TemplateGallery({ variant = 'full', onApply, onStartBlank, onCookTheme }: TemplateGalleryProps) {
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});
  const isFull = variant === 'full';

  return (
    <div className={`template-gallery template-gallery-${variant}`}>
      {isFull && (
        <header className="template-picker-hero">
          <p className="template-picker-eyebrow">Theme Hub</p>
          <h2 className="template-picker-title">Pick a theme for your store</h2>
          <p className="template-picker-sub">
            Your header, shop, checkout, and footer styling come from the theme you select. You can
            customize everything after.
          </p>
        </header>
      )}

      {!isFull && (
        <div className="template-gallery-head">
          <h3 className="template-gallery-title">Theme Hub</h3>
          <p className="template-gallery-sub">5 themes + cook your own.</p>
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
                {isFull ? 'Use this theme' : 'Use theme'}
              </button>
            </div>
          </article>
        ))}

        {onCookTheme && isFull && (
          <article className="template-card template-card--cook">
            <span className="template-card-badge template-card-badge--cook">Custom</span>
            <div className="template-card-preview template-card-preview--cook">
              <div className="template-cook-collage" aria-hidden>
                <img src="/cook-theme/hero.svg" alt="" className="template-cook-collage__hero" />
                <img src="/cook-theme/product-orange.svg" alt="" className="template-cook-collage__product template-cook-collage__product--1" />
                <img src="/cook-theme/product-teal.svg" alt="" className="template-cook-collage__product template-cook-collage__product--2" />
                <img src="/cook-theme/product-gray.svg" alt="" className="template-cook-collage__product template-cook-collage__product--3" />
              </div>
              <div className="template-card-preview-shade template-card-preview-shade--muted" aria-hidden />
            </div>
            <div className="template-card-body">
              <div className="template-card-headline">
                <span className="template-card-name">Cook a theme</span>
                <span className="template-card-tag">Build your own mix</span>
              </div>
              <p className="template-card-desc">
                Pick only the sections you need — hero, collections, reviews, and more — then choose fonts
                and colors. We fill every block with editable placeholders.
              </p>
              <div className="template-swatches template-swatches--placeholder" aria-hidden>
                <span className="template-swatch" style={{ background: '#1a73e8' }} />
                <span className="template-swatch" style={{ background: '#e8f0fe' }} />
                <span className="template-swatch" style={{ background: '#34a853' }} />
                <span className="template-swatch" style={{ background: '#fbbc04' }} />
              </div>
              <button type="button" className="template-apply-btn template-apply-btn--cook" onClick={onCookTheme}>
                <FiZap aria-hidden />
                Cook a theme
              </button>
            </div>
          </article>
        )}

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

      {onCookTheme && !isFull && (
        <button type="button" className="template-start-blank template-start-cook" onClick={onCookTheme}>
          <FiZap aria-hidden /> Cook a theme
        </button>
      )}

      {onStartBlank && !isFull && (
        <button type="button" className="template-start-blank" onClick={onStartBlank}>
          Start from blank
        </button>
      )}
    </div>
  );
}
