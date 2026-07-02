import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import {
  buildCookedWebsiteConfig,
  COOK_SECTION_OPTIONS,
  DEFAULT_COOK_SECTIONS,
  type CookSectionId,
} from '../../config/cookTheme';
import {
  COOK_COLOR_CONCEPTS,
  COOK_COLOR_PRESETS,
  COOK_FONT_OPTIONS,
  cookThemeGoogleFontsHref,
} from '../../config/cookThemePresets';
import type { ThemeSettings, WebsiteModeConfig } from '../../types/homepage';

interface CookThemeWizardProps {
  open: boolean;
  storeName?: string;
  confirmReplace?: boolean;
  onClose: () => void;
  onComplete: (config: WebsiteModeConfig) => void;
}

type WizardStep = 'sections' | 'fonts' | 'colors' | 'cooking';

const STEP_ORDER: WizardStep[] = ['sections', 'fonts', 'colors', 'cooking'];

export default function CookThemeWizard({ open, storeName, confirmReplace, onClose, onComplete }: CookThemeWizardProps) {
  const [step, setStep] = useState<WizardStep>('sections');
  const [selectedSections, setSelectedSections] = useState<Set<CookSectionId>>(
    () => new Set(DEFAULT_COOK_SECTIONS)
  );
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [colorPresetId, setColorPresetId] = useState<string | null>(null);
  const [cookProgress, setCookProgress] = useState(0);

  const selectedColorPreset = useMemo(
    () => (colorPresetId ? COOK_COLOR_PRESETS.find((p) => p.id === colorPresetId) : undefined),
    [colorPresetId]
  );

  const resetWizard = useCallback(() => {
    setStep('sections');
    setSelectedSections(new Set(DEFAULT_COOK_SECTIONS));
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
    if (step !== 'cooking' || !selectedColorPreset || !fontFamily) return;

    setCookProgress(0);
    const interval = window.setInterval(() => {
      setCookProgress((prev) => Math.min(prev + 4, 100));
    }, 80);

    const timeout = window.setTimeout(() => {
      const theme: ThemeSettings = {
        ...selectedColorPreset.theme,
        fontFamily,
      };
      const config = buildCookedWebsiteConfig({
        sections: Array.from(selectedSections),
        theme,
        storeName,
      });
      onComplete(config);
      onClose();
    }, 2200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [step, selectedColorPreset, fontFamily, selectedSections, storeName, onComplete, onClose]);

  if (!open) return null;

  const stepIndex = STEP_ORDER.indexOf(step);
  const sectionCount = selectedSections.size;
  const canContinue =
    (step === 'sections' && sectionCount > 0) ||
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

  const goNext = () => {
    if (!canContinue) return;
    if (step === 'colors') {
      if (confirmReplace) {
        const ok = window.confirm(
          'Apply your cooked theme? Your home page content will be replaced with the sections you picked. Custom pages keep their sections but use the same colors, footer, and shop styling.'
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
              Pick the blocks you need, choose a font and color mood, and we&apos;ll plate up a ready-to-edit
              homepage.
            </p>
          </div>
          <button type="button" className="cook-theme-close" onClick={onClose} aria-label="Close">
            <FiX aria-hidden />
          </button>
        </header>

        <div className="cook-theme-steps" aria-label="Wizard progress">
          {(['sections', 'fonts', 'colors'] as const).map((id, index) => (
            <span
              key={id}
              className={`cook-theme-step${stepIndex >= index ? ' cook-theme-step--active' : ''}${step === id ? ' cook-theme-step--current' : ''}`}
            >
              {index + 1}. {id === 'sections' ? 'Sections' : id === 'fonts' ? 'Fonts' : 'Colors'}
            </span>
          ))}
        </div>

        <div className="cook-theme-body">
          {step === 'sections' && (
            <>
              <p className="cook-theme-step-hint">
                {sectionCount === 0
                  ? 'Select at least one section to include in your theme.'
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
                Plating {sectionCount} block{sectionCount === 1 ? '' : 's'} with your style
              </p>
              <div className="cook-theme-cooking__bar" role="progressbar" aria-valuenow={cookProgress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${cookProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        {step !== 'cooking' && (
          <footer className="cook-theme-footer">
            <button type="button" className="cook-theme-btn cook-theme-btn--ghost" onClick={stepIndex === 0 ? onClose : goBack}>
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
    </div>
  );
}
