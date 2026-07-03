import { useMemo, useState } from 'react';
import { FiLayout, FiPlus, FiZap } from 'react-icons/fi';
import { WEBSITE_TEMPLATES, type WebsiteTemplateId } from '../../config/websiteTemplates';
import type { TemplateIndustry } from '../../config/websiteTemplateIds';

interface TemplateGalleryProps {
  variant?: 'full' | 'compact';
  onApply: (id: WebsiteTemplateId) => void;
  onStartBlank?: () => void;
  onCookTheme?: () => void;
}

const INDUSTRY_SECTIONS: Array<{ id: TemplateIndustry | 'general'; label: string; hint: string }> = [
  { id: 'fashion', label: 'Fashion resale', hint: 'Dresses & occasion wear — catalog to editorial' },
  { id: 'jewellery', label: 'Jewellery', hint: 'Fine, fashion & bridal — counter to luxe' },
  { id: 'general', label: 'All-purpose', hint: 'Flexible themes for any product line' },
];

function TemplateCard({
  tpl,
  isFull,
  failed,
  onFail,
  onApply,
}: {
  tpl: (typeof WEBSITE_TEMPLATES)[number];
  isFull: boolean;
  failed: boolean;
  onFail: () => void;
  onApply: (id: WebsiteTemplateId) => void;
}) {
  return (
    <article key={tpl.id} className="template-card">
      {isFull && tpl.industry === 'fashion' && tpl.id === 'fashion-runway' ? (
        <span className="template-card-badge">New</span>
      ) : isFull && tpl.industry === 'jewellery' && tpl.id === 'jewel-royal' ? (
        <span className="template-card-badge">New</span>
      ) : null}
      <div className="template-card-preview">
        {failed ? (
          <div className="template-card-preview-fallback" style={{ background: tpl.palette[0] }}>
            <span style={{ color: tpl.palette[3] || '#fff' }}>{tpl.name}</span>
          </div>
        ) : (
          <img
            src={tpl.previewImage}
            alt={`${tpl.name} preview`}
            loading="lazy"
            onError={onFail}
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
  );
}

export default function TemplateGallery({
  variant = 'full',
  onApply,
  onStartBlank,
  onCookTheme,
}: TemplateGalleryProps) {
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});
  const isFull = variant === 'full';

  const grouped = useMemo(() => {
    const buckets: Record<string, typeof WEBSITE_TEMPLATES> = {
      fashion: [],
      jewellery: [],
      general: [],
    };
    for (const tpl of WEBSITE_TEMPLATES) {
      const key = tpl.industry || 'general';
      buckets[key].push(tpl);
    }
    return buckets;
  }, []);

  const renderTemplates = (templates: typeof WEBSITE_TEMPLATES) =>
    templates.map((tpl) => (
      <TemplateCard
        key={tpl.id}
        tpl={tpl}
        isFull={isFull}
        failed={!!failedPreviews[tpl.id]}
        onFail={() => setFailedPreviews((prev) => ({ ...prev, [tpl.id]: true }))}
        onApply={onApply}
      />
    ));

  return (
    <div className={`template-gallery template-gallery-${variant}`}>
      {isFull && (
        <header className="template-picker-hero">
          <p className="template-picker-eyebrow">Theme Hub</p>
          <h2 className="template-picker-title">Pick a theme for your store</h2>
          <p className="template-picker-sub">
            Industry-ready layouts for fashion resellers and jewellers — plus flexible all-purpose themes.
            Header, shop, checkout, and footer styling all come from the theme you select.
          </p>
        </header>
      )}

      {!isFull && (
        <div className="template-gallery-head">
          <h3 className="template-gallery-title">Theme Hub</h3>
          <p className="template-gallery-sub">15 themes + cook your own.</p>
        </div>
      )}

      {INDUSTRY_SECTIONS.map((section) => {
        const templates = grouped[section.id];
        if (!templates.length) return null;
        return (
          <section key={section.id} className="template-gallery-industry">
            <header className="template-gallery-industry__head">
              <h3 className="template-gallery-industry__title">{section.label}</h3>
              <p className="template-gallery-industry__hint">{section.hint}</p>
            </header>
            <div className={`template-gallery-grid${isFull ? ' template-gallery-grid--picker' : ''}`}>
              {renderTemplates(templates)}
            </div>
          </section>
        );
      })}

      {isFull ? (
        <div className={`template-gallery-grid template-gallery-grid--picker template-gallery-grid--extras`}>
        {onCookTheme && (
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

        {onStartBlank && (
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
      ) : null}

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
