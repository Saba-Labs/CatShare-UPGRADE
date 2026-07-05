import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import {
  buildCookedWebsiteConfig,
  COOK_BUTTON_STYLE_OPTIONS,
  COOK_FOOTER_OPTIONS,
  COOK_HEADER_OPTIONS,
  COOK_POLICY_PAGE_OPTIONS,
  COOK_PRODUCT_CARD_OPTIONS,
  COOK_SECTION_OPTIONS,
  DEFAULT_COOK_POLICY_PAGES,
  DEFAULT_COOK_SECTIONS,
  DEFAULT_COOK_STOREFRONT,
  type CookCategoryStyle,
  type CookPolicyPageId,
  type CookSectionId,
  type CookStorefrontChoices,
} from '../../config/cookTheme';
import {
  COOK_COLOR_CONCEPTS,
  COOK_COLOR_PRESETS,
  COOK_FONT_OPTIONS,
  cookThemeGoogleFontsHref,
} from '../../config/cookThemePresets';
import type { ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import CookThemePreview, { type CookPreviewScrollTarget } from './CookThemePreview';

interface CookThemeWizardProps {
  open: boolean;
  storeName?: string;
  confirmReplace?: boolean;
  onClose: () => void;
  onComplete: (config: WebsiteModeConfig) => void;
}

type WizardStep = 'sections' | 'storefront' | 'pages' | 'fonts' | 'colors' | 'cooking';

const STEP_ORDER: WizardStep[] = ['sections', 'storefront', 'pages', 'fonts', 'colors', 'cooking'];

const STEP_LABELS: Record<Exclude<WizardStep, 'cooking'>, string> = {
  sections: 'Sections',
  storefront: 'Storefront',
  pages: 'Pages',
  fonts: 'Fonts',
  colors: 'Colors',
};

function CookChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: { id: T; label: string; hint: string }[];
  value: T;
  onChange: (next: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div className={`cook-choice-grid cook-choice-grid--cols-${columns}`}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`cook-choice-card${value === opt.id ? ' cook-choice-card--selected' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          <span className="cook-choice-card__label">{opt.label}</span>
          <span className="cook-choice-card__hint">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}

export default function CookThemeWizard({ open, storeName, confirmReplace, onClose, onComplete }: CookThemeWizardProps) {
  const [step, setStep] = useState<WizardStep>('sections');
  const [selectedSections, setSelectedSections] = useState<Set<CookSectionId>>(
    () => new Set(DEFAULT_COOK_SECTIONS)
  );
  const [storefront, setStorefront] = useState<CookStorefrontChoices>(DEFAULT_COOK_STOREFRONT);
  const [selectedPages, setSelectedPages] = useState<Set<CookPolicyPageId>>(
    () => new Set(DEFAULT_COOK_POLICY_PAGES)
  );
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [colorPresetId, setColorPresetId] = useState<string | null>(null);
  const [cookProgress, setCookProgress] = useState(0);
  const [previewScrollFocus, setPreviewScrollFocus] = useState<CookPreviewScrollTarget | null>(null);
  const [previewScrollRequest, setPreviewScrollRequest] = useState(0);
  const cookFinishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onCloseRef = useRef(onClose);

  onCompleteRef.current = onComplete;
  onCloseRef.current = onClose;

  const focusPreview = useCallback((target: CookPreviewScrollTarget) => {
    setPreviewScrollFocus(target);
    setPreviewScrollRequest((request) => request + 1);
  }, []);

  const clearPreviewScrollFocus = useCallback(() => {
    setPreviewScrollFocus(null);
  }, []);

  const selectedColorPreset = useMemo(
    () => (colorPresetId ? COOK_COLOR_PRESETS.find((p) => p.id === colorPresetId) : undefined),
    [colorPresetId]
  );

  const hasCategorySections = selectedSections.has('categories') || selectedSections.has('featured-collections');
  const hasHeader = selectedSections.has('header');
  const hasFooter = selectedSections.has('footer');

  const resetWizard = useCallback(() => {
    cookFinishedRef.current = false;
    setStep('sections');
    setSelectedSections(new Set(DEFAULT_COOK_SECTIONS));
    setStorefront(DEFAULT_COOK_STOREFRONT);
    setSelectedPages(new Set(DEFAULT_COOK_POLICY_PAGES));
    setFontFamily(null);
    setColorPresetId(null);
    setCookProgress(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetWizard();
  }, [open, resetWizard]);

  useEffect(() => {
    if (!open) return;
    const id = 'cook-theme-google-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = cookThemeGoogleFontsHref();
    document.head.appendChild(link);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 'cooking' || !selectedColorPreset || !fontFamily || cookFinishedRef.current) {
      return;
    }

    setCookProgress(0);
    const interval = window.setInterval(() => {
      setCookProgress((prev) => Math.min(prev + 4, 100));
    }, 80);

    const timeout = window.setTimeout(() => {
      if (cookFinishedRef.current) return;
      cookFinishedRef.current = true;

      const theme: ThemeSettings = {
        ...selectedColorPreset.theme,
        fontFamily,
        buttonStyle: storefront.buttonStyle,
      };
      const config = buildCookedWebsiteConfig({
        sections: Array.from(selectedSections),
        theme,
        storeName,
        storefront,
        policyPages: Array.from(selectedPages),
      });
      onCompleteRef.current(config);
      onCloseRef.current();
    }, 2200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [
    open,
    step,
    selectedColorPreset,
    fontFamily,
    selectedSections,
    storefront,
    selectedPages,
    storeName,
  ]);

  if (!open) return null;

  const stepIndex = STEP_ORDER.indexOf(step);
  const sectionCount = selectedSections.size;
  const pageCount = selectedPages.size;

  const canContinue =
    (step === 'sections' && sectionCount > 0) ||
    step === 'storefront' ||
    (step === 'pages' && pageCount > 0) ||
    (step === 'fonts' && fontFamily !== null) ||
    (step === 'colors' && colorPresetId !== null);

  const toggleSection = (id: CookSectionId) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = (id: CookPolicyPageId) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchCategoryStyle = (patch: Partial<CookCategoryStyle>) => {
    setStorefront((prev) => ({
      ...prev,
      categoryStyle: { ...prev.categoryStyle, ...patch },
    }));
    focusPreview('category');
  };

  const goNext = () => {
    if (!canContinue) return;
    if (step === 'colors') {
      if (confirmReplace) {
        const ok = window.confirm(
          'Apply your cooked theme? Your home page content will be replaced with the sections you picked. Selected policy pages will be created and linked in your footer.'
        );
        if (!ok) return;
      }
    }
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const previewTheme: ThemeSettings | undefined = selectedColorPreset
    ? { ...selectedColorPreset.theme, fontFamily: fontFamily || selectedColorPreset.theme.fontFamily }
    : undefined;

  const previewStepLabel = step !== 'cooking' ? STEP_LABELS[step] : undefined;

  return (
    <div className="cook-theme-overlay" role="dialog" aria-modal="true" aria-labelledby="cook-theme-title">
      <button type="button" className="cook-theme-backdrop" aria-label="Close" onClick={onClose} />
      <div className="cook-theme-modal">
        <header className="cook-theme-header">
          <div>
            <p className="cook-theme-eyebrow">Theme Hub</p>
            <h2 id="cook-theme-title" className="cook-theme-title">
              Cook a theme
            </h2>
            <p className="cook-theme-sub">
              Pick homepage blocks, storefront styling, policy pages, fonts, and colors — we&apos;ll build a
              ready-to-edit store.
            </p>
          </div>
          <button type="button" className="cook-theme-close" onClick={onClose} aria-label="Close">
            <FiX aria-hidden />
          </button>
        </header>

        <div className="cook-theme-steps" aria-label="Wizard progress">
          {(Object.keys(STEP_LABELS) as Array<Exclude<WizardStep, 'cooking'>>).map((id, index) => (
            <span
              key={id}
              className={`cook-theme-step${stepIndex >= index ? ' cook-theme-step--active' : ''}${step === id ? ' cook-theme-step--current' : ''}`}
            >
              {index + 1}. {STEP_LABELS[id]}
            </span>
          ))}
        </div>

        <div className={`cook-theme-layout${step === 'cooking' ? ' cook-theme-layout--cooking' : ''}`}>
          <div className="cook-theme-main">
            <div className="cook-theme-body">
          {step === 'sections' && (
            <>
              <p className="cook-theme-step-hint">
                {sectionCount === 0
                  ? 'Select at least one section — include Header and Footer for a complete storefront shell.'
                  : `${sectionCount} section${sectionCount === 1 ? '' : 's'} selected`}
              </p>
              <div className="cook-section-grid">
                {COOK_SECTION_OPTIONS.map((option) => {
                  const checked = selectedSections.has(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`cook-section-card${checked ? ' cook-section-card--selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="cook-section-card__input"
                        checked={checked}
                        onChange={() => toggleSection(option.id)}
                      />
                      <span className="cook-section-card__check" aria-hidden>
                        {checked ? <FiCheck /> : null}
                      </span>
                      <span className="cook-section-card__preview">
                        <img src={option.previewImage} alt="" loading="lazy" />
                      </span>
                      <span className="cook-section-card__label">{option.label}</span>
                      <span className="cook-section-card__desc">{option.description}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {step === 'storefront' && (
            <>
              <p className="cook-theme-step-hint">
                Choose header, footer, buttons, and product cards — watch the live preview update on the right.
              </p>

              <div className="cook-theme-panel">
                <h3 className="cook-theme-panel__title">Header layout</h3>
                {!hasHeader ? (
                  <p className="cook-theme-panel__note">Add the Header section above to show a top bar on your site.</p>
                ) : null}
                <CookChoiceGrid
                  options={COOK_HEADER_OPTIONS}
                  value={storefront.headerVariant}
                  onChange={(headerVariant) => {
                    setStorefront((prev) => ({ ...prev, headerVariant }));
                    focusPreview('header');
                  }}
                />
              </div>

              <div className="cook-theme-panel">
                <h3 className="cook-theme-panel__title">Footer layout</h3>
                {!hasFooter ? (
                  <p className="cook-theme-panel__note">Add the Footer section above to show a site footer.</p>
                ) : null}
                <CookChoiceGrid
                  options={COOK_FOOTER_OPTIONS}
                  value={storefront.footerVariant}
                  onChange={(footerVariant) => {
                    setStorefront((prev) => ({ ...prev, footerVariant }));
                    focusPreview('footer');
                  }}
                />
              </div>

              <div className="cook-theme-panel">
                <h3 className="cook-theme-panel__title">Button style</h3>
                <CookChoiceGrid
                  options={COOK_BUTTON_STYLE_OPTIONS}
                  value={storefront.buttonStyle}
                  onChange={(buttonStyle) => {
                    setStorefront((prev) => ({ ...prev, buttonStyle }));
                    focusPreview('button');
                  }}
                  columns={3}
                />
              </div>

              <div className="cook-theme-panel">
                <h3 className="cook-theme-panel__title">Product card style</h3>
                <p className="cook-theme-panel__note">Used on collection pages and product grids across your store.</p>
                <div className="cook-choice-grid cook-choice-grid--cols-2">
                  {COOK_PRODUCT_CARD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`cook-choice-card${storefront.productCardStyle === opt.id ? ' cook-choice-card--selected' : ''}`}
                      onClick={() => {
                        setStorefront((prev) => ({ ...prev, productCardStyle: opt.id }));
                        focusPreview('product-card');
                      }}
                    >
                      <span className="cook-choice-card__label">{opt.label}</span>
                      <span className="cook-choice-card__hint">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {hasCategorySections ? (
                <div className="cook-theme-panel">
                  <h3 className="cook-theme-panel__title">Category tiles</h3>
                  <p className="cook-theme-panel__note">Applies to the Shop by category section in your preview.</p>
                  <div className="cook-theme-field-row">
                    <label className="cook-theme-field">
                      <span className="cook-theme-field__label">Tile look</span>
                      <select
                        className="cook-theme-field__select"
                        value={storefront.categoryStyle.cardStyle}
                        onChange={(e) =>
                          patchCategoryStyle({ cardStyle: e.target.value as CookCategoryStyle['cardStyle'] })
                        }
                      >
                        <option value="card">Card tiles</option>
                        <option value="minimal">Minimal tiles</option>
                      </select>
                    </label>
                    <label className="cook-theme-field">
                      <span className="cook-theme-field__label">Shape</span>
                      <select
                        className="cook-theme-field__select"
                        value={storefront.categoryStyle.cardShape}
                        onChange={(e) =>
                          patchCategoryStyle({ cardShape: e.target.value as CookCategoryStyle['cardShape'] })
                        }
                      >
                        <option value="rounded">Rounded square</option>
                        <option value="circle">Circle</option>
                      </select>
                    </label>
                    <label className="cook-theme-field">
                      <span className="cook-theme-field__label">Size</span>
                      <select
                        className="cook-theme-field__select"
                        value={storefront.categoryStyle.cardSize}
                        onChange={(e) =>
                          patchCategoryStyle({ cardSize: e.target.value as CookCategoryStyle['cardSize'] })
                        }
                      >
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                      </select>
                    </label>
                    <label className="cook-theme-field">
                      <span className="cook-theme-field__label">Layout</span>
                      <select
                        className="cook-theme-field__select"
                        value={storefront.categoryStyle.layout}
                        onChange={(e) =>
                          patchCategoryStyle({ layout: e.target.value as CookCategoryStyle['layout'] })
                        }
                      >
                        <option value="grid">Grid</option>
                        <option value="carousel">Scroll row</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {step === 'pages' && (
            <>
              <p className="cook-theme-step-hint">
                {pageCount === 0
                  ? 'Select at least one page — we create each page and link it in your footer (and header where appropriate).'
                  : `${pageCount} page${pageCount === 1 ? '' : 's'} will be created with editable placeholder copy`}
              </p>
              <div className="cook-section-grid cook-section-grid--pages">
                {COOK_POLICY_PAGE_OPTIONS.map((option) => {
                  const checked = selectedPages.has(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`cook-section-card cook-section-card--page${checked ? ' cook-section-card--selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="cook-section-card__input"
                        checked={checked}
                        onChange={() => togglePage(option.id)}
                      />
                      <span className="cook-section-card__check" aria-hidden>
                        {checked ? <FiCheck /> : null}
                      </span>
                      <span className="cook-section-card__label">{option.label}</span>
                      <span className="cook-section-card__desc">{option.description}</span>
                      <span className="cook-section-card__slug">/{option.slug}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {step === 'fonts' && (
            <>
              <p className="cook-theme-step-hint">
                {fontFamily === null
                  ? 'Choose one font — each option suits a different store personality.'
                  : 'Font selected — continue to pick your colors.'}
              </p>
              <div className="cook-font-grid">
                {COOK_FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`cook-font-card${fontFamily === opt.value ? ' cook-font-card--selected' : ''}`}
                    onClick={() => setFontFamily(opt.value)}
                    style={{ fontFamily: opt.value }}
                  >
                    <span className="cook-font-card__concept">{opt.concept}</span>
                    <span className="cook-font-card__sample">Aa Bb Cc</span>
                    <span className="cook-font-card__name">{opt.label}</span>
                    <span className="cook-font-card__preview" style={{ fontFamily: opt.value }}>
                      {opt.sampleLine}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'colors' && (
            <>
              <p className="cook-theme-step-hint">
                {colorPresetId === null
                  ? 'Choose one color palette — each reflects a different brand mood.'
                  : 'Palette selected — ready to cook your theme.'}
              </p>
              <div className="cook-color-grid">
                {COOK_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`cook-color-card${colorPresetId === preset.id ? ' cook-color-card--selected' : ''}`}
                    onClick={() => setColorPresetId(preset.id)}
                  >
                    <span className="cook-color-card__concept">{COOK_COLOR_CONCEPTS[preset.id]}</span>
                    <span className="cook-color-card__swatches">
                      <span style={{ background: preset.theme.primaryColor }} />
                      <span style={{ background: preset.theme.secondaryColor }} />
                      <span style={{ background: preset.theme.backgroundColor }} />
                      <span style={{ background: preset.theme.accentColor }} />
                    </span>
                    <span className="cook-color-card__name">{preset.name}</span>
                    <span
                      className="cook-color-card__chip"
                      style={{
                        background: preset.theme.primaryColor,
                        color: preset.theme.backgroundColor,
                      }}
                    >
                      Shop now
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'cooking' && (
            <div className="cook-theme-cooking">
              <div className="cook-theme-cooking__visual" aria-hidden>
                <span className="cook-theme-cooking__pot" />
                <span className="cook-theme-cooking__steam cook-theme-cooking__steam--1" />
                <span className="cook-theme-cooking__steam cook-theme-cooking__steam--2" />
                <span className="cook-theme-cooking__steam cook-theme-cooking__steam--3" />
              </div>
              <p className="cook-theme-cooking__title">Cooking your theme…</p>
              <p className="cook-theme-cooking__sub">
                Plating {sectionCount} block{sectionCount === 1 ? '' : 's'}, {pageCount} page
                {pageCount === 1 ? '' : 's'}, and your storefront styling
              </p>
              <div
                className="cook-theme-cooking__bar"
                role="progressbar"
                aria-valuenow={cookProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${cookProgress}%` }} />
              </div>
            </div>
          )}
            </div>

            {step !== 'cooking' && (
              <footer className="cook-theme-footer">
                <button
                  type="button"
                  className="cook-theme-btn cook-theme-btn--ghost"
                  onClick={stepIndex === 0 ? onClose : goBack}
                >
                  {stepIndex === 0 ? (
                    'Cancel'
                  ) : (
                    <>
                      <FiChevronLeft aria-hidden /> Back
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="cook-theme-btn cook-theme-btn--primary"
                  onClick={goNext}
                  disabled={!canContinue}
                >
                  {step === 'colors' ? (
                    'Start cooking'
                  ) : (
                    <>
                      Continue <FiChevronRight aria-hidden />
                    </>
                  )}
                </button>
              </footer>
            )}
          </div>

          {step !== 'cooking' ? (
            <CookThemePreview
              storeName={storeName}
              selectedSections={selectedSections}
              storefront={storefront}
              selectedPages={selectedPages}
              theme={previewTheme}
              fontFamily={fontFamily}
              activeStep={previewStepLabel}
              scrollFocus={previewScrollFocus}
              scrollRequest={previewScrollRequest}
              onManualScroll={clearPreviewScrollFocus}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
