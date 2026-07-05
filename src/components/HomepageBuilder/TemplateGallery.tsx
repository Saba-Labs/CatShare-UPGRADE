import { useMemo, useState } from 'react';
import { FiLayout, FiPlus, FiZap } from 'react-icons/fi';
import { WEBSITE_TEMPLATES, type WebsiteTemplateMeta, type WebsiteTemplateId } from '../../config/websiteTemplates';
import type { TemplateIndustry, TemplateStyle } from '../../config/websiteTemplateIds';

interface TemplateGalleryProps {
  variant?: 'full' | 'compact';
  onApply: (id: WebsiteTemplateId) => void;
  onStartBlank?: () => void;
  onCookTheme?: () => void;
}

type StyleFilter = 'all' | 'basics' | 'modern' | 'traditional';
type IndustryFilter = 'all' | TemplateIndustry;

const STYLE_FILTERS: { id: StyleFilter; label: string }[] = [
  { id: 'all', label: 'All styles' },
  { id: 'basics', label: 'Basics' },
  { id: 'modern', label: 'Modern' },
  { id: 'traditional', label: 'Traditional' },
];

const INDUSTRY_FILTERS: { id: IndustryFilter; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'fashion', label: 'Fashion & textiles' },
  { id: 'jewellery', label: 'Jewellery' },
  { id: 'general', label: 'General' },
];

const DEFAULT_STORE_ID: WebsiteTemplateId = 'default-store';

const STYLE_CHIP_LABEL: Record<TemplateStyle, string> = {
  catalog: 'Basics',
  subtle: 'Basics',
  modern: 'Modern',
  traditional: 'Traditional',
};

const INDUSTRY_CHIP_LABEL: Record<TemplateIndustry, string> = {
  general: 'General',
  fashion: 'Fashion',
  jewellery: 'Jewellery',
};

function matchesStyleFilter(style: TemplateStyle | undefined, filter: StyleFilter): boolean {
  if (filter === 'all') return true;
  if (!style) return filter === 'basics';
  if (filter === 'basics') return style === 'catalog' || style === 'subtle';
  return style === filter;
}

function matchesIndustryFilter(industry: TemplateIndustry | undefined, filter: IndustryFilter): boolean {
  if (filter === 'all') return true;
  return (industry || 'general') === filter;
}

function TemplateCard({
  tpl,
  isFull,
  failed,
  onFail,
  onApply,
}: {
  tpl: WebsiteTemplateMeta;
  isFull: boolean;
  failed: boolean;
  onFail: () => void;
  onApply: (id: WebsiteTemplateId) => void;
}) {
  const industry = tpl.industry || 'general';
  const style = tpl.style;
  const isComingSoon = tpl.comingSoon === true;

  return (
    <article className={`template-card${isComingSoon ? ' template-card--coming-soon' : ''}`}>
      {isFull && isComingSoon ? (
        <span className="template-card-badge template-card-badge--soon">Coming soon</span>
      ) : isFull && tpl.id === 'fashion-runway' ? (
        <span className="template-card-badge">New</span>
      ) : isFull && tpl.id === 'jewel-royal' ? (
        <span className="template-card-badge">New</span>
      ) : null}
      <div className="template-card-preview">
        {failed ? (
          <div className="template-card-preview-fallback" style={{ background: tpl.palette[0] }}>
            <span style={{ color: tpl.palette[3] || '#fff' }}>{tpl.name}</span>
          </div>
        ) : (
          <img src={tpl.previewImage} alt={`${tpl.name} preview`} loading="lazy" onError={onFail} />
        )}
        <div className="template-card-preview-shade" aria-hidden />
      </div>
      <div className="template-card-body">
        <div className="template-card-headline">
          <span className="template-card-name">{tpl.name}</span>
          <span className="template-card-tag">{tpl.tagline}</span>
        </div>
        {isFull ? (
          <>
            <div className="template-card-tags" aria-label="Theme tags">
              {style ? (
                <span className="template-card-chip template-card-chip--style">{STYLE_CHIP_LABEL[style]}</span>
              ) : null}
              <span className="template-card-chip template-card-chip--industry">
                {INDUSTRY_CHIP_LABEL[industry]}
              </span>
            </div>
            <p className="template-card-desc">{tpl.description}</p>
          </>
        ) : null}
        <div className="template-swatches" aria-label="Color palette">
          {tpl.palette.map((color) => (
            <span key={color} className="template-swatch" style={{ background: color }} title={color} />
          ))}
        </div>
        <button
          type="button"
          className="template-apply-btn"
          onClick={() => {
            if (!isComingSoon) onApply(tpl.id);
          }}
          disabled={isComingSoon}
          aria-disabled={isComingSoon}
          title={isComingSoon ? `${tpl.name} — coming soon` : `Use ${tpl.name}`}
        >
          {isComingSoon ? 'Coming soon' : isFull ? 'Use this theme' : 'Use theme'}
        </button>
      </div>
    </article>
  );
}

function FilterChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="template-filter-row">
      <span className="template-filter-row__label">{label}</span>
      <div className="template-filter-chips" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`template-filter-chip${value === opt.id ? ' is-active' : ''}`}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TemplateGallery({
  variant = 'full',
  onApply,
  onStartBlank,
  onCookTheme,
}: TemplateGalleryProps) {
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>('all');
  const isFull = variant === 'full';

  const defaultStoreTemplate = useMemo(
    () => WEBSITE_TEMPLATES.find((tpl) => tpl.id === DEFAULT_STORE_ID),
    []
  );

  const catalogTemplates = useMemo(
    () => WEBSITE_TEMPLATES.filter((tpl) => tpl.id !== DEFAULT_STORE_ID),
    []
  );

  const filteredTemplates = useMemo(
    () =>
      catalogTemplates.filter(
        (tpl) =>
          matchesStyleFilter(tpl.style, styleFilter) &&
          matchesIndustryFilter(tpl.industry, industryFilter)
      ),
    [catalogTemplates, styleFilter, industryFilter]
  );

  const renderTemplateCard = (tpl: WebsiteTemplateMeta) => (
    <TemplateCard
      key={tpl.id}
      tpl={tpl}
      isFull={isFull}
      failed={!!failedPreviews[tpl.id]}
      onFail={() => setFailedPreviews((prev) => ({ ...prev, [tpl.id]: true }))}
      onApply={onApply}
    />
  );

  return (
    <div className={`template-gallery template-gallery-${variant}`}>
      {isFull && (
        <header className="template-picker-hero">
          <p className="template-picker-eyebrow">Theme Hub</p>
          <h2 className="template-picker-title">Pick a theme for your store</h2>
          <p className="template-picker-sub">
            Start blank, cook your own mix, or choose a ready-made layout — filter by style and business type.
          </p>
        </header>
      )}

      {!isFull && (
        <div className="template-gallery-head">
          <h3 className="template-gallery-title">Theme Hub</h3>
          <p className="template-gallery-sub">15 themes + cook your own.</p>
        </div>
      )}

      {isFull ? (
        <div className="template-picker-filters">
          <FilterChipRow<StyleFilter>
            label="Style"
            options={STYLE_FILTERS}
            value={styleFilter}
            onChange={setStyleFilter}
          />
          <FilterChipRow<IndustryFilter>
            label="Business"
            options={INDUSTRY_FILTERS}
            value={industryFilter}
            onChange={setIndustryFilter}
          />
        </div>
      ) : null}

      <div className={`template-gallery-grid${isFull ? ' template-gallery-grid--picker' : ''}`}>
        {onStartBlank ? (
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
              {isFull ? (
                <p className="template-card-desc">
                  Skip presets and add blocks one by one. Footer and theme use simple defaults until you style them.
                </p>
              ) : null}
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
        ) : null}

        {onCookTheme ? (
          <article className="template-card template-card--cook">
            <span className="template-card-badge template-card-badge--cook">Custom</span>
            <div className="template-card-preview template-card-preview--cook">
              <div className="template-cook-collage" aria-hidden>
                <img src="/cook-theme/hero.svg" alt="" className="template-cook-collage__hero" />
                <img
                  src="/cook-theme/product-orange.svg"
                  alt=""
                  className="template-cook-collage__product template-cook-collage__product--1"
                />
                <img
                  src="/cook-theme/product-teal.svg"
                  alt=""
                  className="template-cook-collage__product template-cook-collage__product--2"
                />
                <img
                  src="/cook-theme/product-gray.svg"
                  alt=""
                  className="template-cook-collage__product template-cook-collage__product--3"
                />
              </div>
              <div className="template-card-preview-shade template-card-preview-shade--muted" aria-hidden />
            </div>
            <div className="template-card-body">
              <div className="template-card-headline">
                <span className="template-card-name">Cook a theme</span>
                <span className="template-card-tag">Build your own mix</span>
              </div>
              {isFull ? (
                <p className="template-card-desc">
                  Pick only the sections you need — hero, collections, reviews, and more — then choose fonts and
                  colors. We fill every block with editable placeholders.
                </p>
              ) : null}
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
        ) : null}

        {defaultStoreTemplate ? renderTemplateCard(defaultStoreTemplate) : null}

        {filteredTemplates.map((tpl) => renderTemplateCard(tpl))}
      </div>

      {isFull && filteredTemplates.length === 0 ? (
        <p className="template-gallery-empty">No themes match these filters. Try a broader style or business type.</p>
      ) : null}

      {onCookTheme && !isFull ? (
        <button type="button" className="template-start-blank template-start-cook" onClick={onCookTheme}>
          <FiZap aria-hidden /> Cook a theme
        </button>
      ) : null}

      {onStartBlank && !isFull ? (
        <button type="button" className="template-start-blank" onClick={onStartBlank}>
          Start from blank
        </button>
      ) : null}
    </div>
  );
}
