import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { ThemeSettings } from '../../types/homepage';
import {
  buildCookPreviewLayout,
  COOK_SECTION_OPTIONS,
  type CookPolicyPageId,
  type CookSectionId,
  type CookStorefrontChoices,
} from '../../config/cookTheme';
import { getBlockInnerStyle, getBlockRowStyle } from '../../utils/blockLayout';
import { preventBuilderLinkNavigation } from '../../utils/builderNavigation';
import { homepageUsesHeroHeaderOverlay } from '../../utils/immersiveHeaderOverlay';
import StorefrontSiteHeader from '../Storefront/StorefrontSiteHeader';
import WebsiteFooter from '../WebsiteBuilder/WebsiteFooter';
import '../WebsiteBuilder/website-runtime.css';
import SectionRenderer from './sections/SectionRenderer';

export type CookPreviewScrollTarget = 'header' | 'footer' | 'button' | 'product-card' | 'category';

const SECTION_SCROLL_TARGETS = new Set<CookPreviewScrollTarget>(['button', 'product-card', 'category']);

const SECTION_CONTENT_SELECTORS: Record<'button' | 'product-card' | 'category', string> = {
  button: '.banner-section, .cta-section, .feature-card-section',
  'product-card': '.website-section-products',
  category: 'section.cat-showcase',
};

const CATEGORY_SECTION_TITLES = {
  primary: 'Shop by category',
} as const;

const PREVIEW_SCROLL_PADDING = 12;
const PREVIEW_SMOOTH_SETTLE_MS = 420;

function pinPreviewScrollX(scrollEl: HTMLElement) {
  if (scrollEl.scrollLeft !== 0) {
    scrollEl.scrollLeft = 0;
  }
}

function scrollPreviewToTop(scrollEl: HTMLElement, behavior: ScrollBehavior = 'auto') {
  scrollEl.scrollTo({ top: 0, left: 0, behavior });
  pinPreviewScrollX(scrollEl);
}

function scrollPreviewToBottom(scrollEl: HTMLElement, behavior: ScrollBehavior = 'auto') {
  scrollEl.scrollTo({
    top: Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight),
    left: 0,
    behavior,
  });
  pinPreviewScrollX(scrollEl);
}

function findFirstPreviewAnchor(
  scrollEl: HTMLElement,
  target: CookPreviewScrollTarget
): HTMLElement | null {
  const marker = scrollEl.querySelector(
    `[data-cook-preview-target="${target}"][data-cook-preview-first="true"]`
  ) as HTMLElement | null;
  if (!marker) return null;

  if (!SECTION_SCROLL_TARGETS.has(target)) {
    return marker;
  }

  const selector = SECTION_CONTENT_SELECTORS[target as 'button' | 'product-card' | 'category'];
  const row = marker.closest('[data-cook-preview-section-row="true"]') as HTMLElement | null;
  const content = row?.querySelector(selector) as HTMLElement | null;
  return content ?? row ?? marker;
}

/** Position inside the preview scroll container (works with CSS zoom). */
function getScrollTopForPreviewTarget(
  scrollEl: HTMLElement,
  targetEl: HTMLElement,
  padding = PREVIEW_SCROLL_PADDING
): number | null {
  if (!scrollEl.contains(targetEl)) return null;

  const scrollRect = scrollEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  return Math.max(0, scrollEl.scrollTop + targetRect.top - scrollRect.top - padding);
}

function isPreviewTargetInView(
  scrollEl: HTMLElement,
  target: CookPreviewScrollTarget,
  padding = PREVIEW_SCROLL_PADDING
): boolean {
  if (target === 'header') {
    return scrollEl.scrollTop <= padding;
  }

  if (target === 'footer') {
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    return scrollEl.scrollTop >= maxScroll - padding;
  }

  const targetEl = findFirstPreviewAnchor(scrollEl, target);
  if (!targetEl) return false;

  const scrollRect = scrollEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const visibleHeight = Math.min(targetRect.bottom, scrollRect.bottom) - Math.max(targetRect.top, scrollRect.top + padding);
  return visibleHeight >= Math.min(120, targetRect.height * 0.35);
}

function scrollPreviewToFirstSection(
  scrollEl: HTMLElement,
  target: 'button' | 'product-card' | 'category',
  padding = PREVIEW_SCROLL_PADDING,
  behavior: ScrollBehavior = 'auto'
): boolean {
  const targetEl = findFirstPreviewAnchor(scrollEl, target);
  if (!targetEl) return false;

  const top = getScrollTopForPreviewTarget(scrollEl, targetEl, padding);
  if (top == null) return false;

  scrollEl.scrollTo({
    top,
    left: 0,
    behavior,
  });
  pinPreviewScrollX(scrollEl);
  return true;
}

function anchorPreviewTarget(
  scrollEl: HTMLElement,
  target: CookPreviewScrollTarget,
  padding = PREVIEW_SCROLL_PADDING,
  behavior: ScrollBehavior = 'auto'
): boolean {
  if (target === 'header') {
    scrollPreviewToTop(scrollEl, behavior);
    return true;
  }

  if (target === 'footer') {
    scrollPreviewToBottom(scrollEl, behavior);
    return true;
  }

  return scrollPreviewToFirstSection(scrollEl, target, padding, behavior);
}

function shouldSettlePreviewAnchor(target: CookPreviewScrollTarget): boolean {
  return target === 'header';
}

function runPreviewAnchor(
  scrollEl: HTMLElement,
  target: CookPreviewScrollTarget,
  behavior: ScrollBehavior,
  programmaticScrollRef: MutableRefObject<boolean>
) {
  const scroll = (scrollBehavior: ScrollBehavior) => {
    if (!anchorPreviewTarget(scrollEl, target, PREVIEW_SCROLL_PADDING, scrollBehavior)) {
      return false;
    }
    markProgrammaticScroll(programmaticScrollRef, scrollBehavior);
    return true;
  };

  if (scroll(behavior)) {
    if (target === 'category') {
      window.setTimeout(() => {
        scroll('auto');
      }, 100);
    } else if (behavior === 'smooth' && (target === 'button' || target === 'product-card')) {
      window.setTimeout(() => {
        scroll('auto');
      }, PREVIEW_SMOOTH_SETTLE_MS);
    }
    return;
  }

  if (!SECTION_SCROLL_TARGETS.has(target)) return;

  window.requestAnimationFrame(() => {
    scroll(behavior);
  });
}

function settlePreviewAnchor(
  scrollEl: HTMLElement,
  target: CookPreviewScrollTarget,
  programmaticScrollRef: MutableRefObject<boolean>,
  isCancelled: () => boolean
) {
  if (!shouldSettlePreviewAnchor(target)) return;

  window.setTimeout(() => {
    if (isCancelled()) return;
    runPreviewAnchor(scrollEl, target, 'auto', programmaticScrollRef);
  }, 120);

  if (target === 'header') {
    window.setTimeout(() => {
      if (isCancelled()) return;
      runPreviewAnchor(scrollEl, target, 'auto', programmaticScrollRef);
    }, 220);
  }
}

function markProgrammaticScroll(programmaticScrollRef: MutableRefObject<boolean>, behavior: ScrollBehavior) {
  programmaticScrollRef.current = true;
  window.setTimeout(
    () => {
      programmaticScrollRef.current = false;
    },
    behavior === 'smooth' ? 480 : 120
  );
}

const DEFAULT_PREVIEW_THEME: ThemeSettings = {
  primaryColor: '#1a73e8',
  secondaryColor: '#e8f0fe',
  backgroundColor: '#ffffff',
  textColor: '#202124',
  accentColor: '#d93025',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  buttonStyle: 'solid',
};

export interface CookThemePreviewProps {
  storeName?: string;
  selectedSections: Set<CookSectionId>;
  storefront: CookStorefrontChoices;
  selectedPages: Set<CookPolicyPageId>;
  theme?: ThemeSettings;
  fontFamily?: string | null;
  activeStep?: string;
  scrollFocus?: CookPreviewScrollTarget | null;
  scrollRequest?: number;
  onManualScroll?: () => void;
}

export default function CookThemePreview({
  storeName = 'My Store',
  selectedSections,
  storefront,
  selectedPages,
  theme: themeOverride,
  fontFamily,
  activeStep,
  scrollFocus,
  scrollRequest = 0,
  onManualScroll,
}: CookThemePreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const prevScrollFocusRef = useRef<CookPreviewScrollTarget | null>(null);
  const prevScrollRequestRef = useRef(0);

  const layout = useMemo(() => {
    const theme: ThemeSettings = {
      ...DEFAULT_PREVIEW_THEME,
      ...themeOverride,
      fontFamily: fontFamily || themeOverride?.fontFamily || DEFAULT_PREVIEW_THEME.fontFamily,
      buttonStyle: storefront.buttonStyle,
    };
    return buildCookPreviewLayout(
      {
        sections: Array.from(selectedSections),
        theme,
        storeName,
        storefront,
        policyPages: Array.from(selectedPages),
      },
      { mobileViewport: false }
    );
  }, [selectedSections, themeOverride, fontFamily, storeName, storefront, selectedPages]);

  const sections = useMemo(
    () => [...(layout.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [layout.sections]
  );

  const siteSettings = layout.websiteConfig?.siteSettings;
  const heroHeaderOverlay = homepageUsesHeroHeaderOverlay(siteSettings?.headerVariant, sections);
  const overlayHeaderInEditor = heroHeaderOverlay;

  const sectionCount = selectedSections.size;
  const pageCount = selectedPages.size;

  const cookSourceBySectionId = useMemo(() => {
    const map = new Map<string, CookSectionId>();
    const selectedOptions = COOK_SECTION_OPTIONS.filter(
      (option) => option.kind === 'section' && selectedSections.has(option.id)
    );
    const sortedSections = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    selectedOptions.forEach((option, index) => {
      const section = sortedSections[index];
      if (section) {
        map.set(section.id, option.id);
      }
    });

    return map;
  }, [sections, selectedSections]);

  const sectionScrollTargets = useMemo(() => {
    const targets: Partial<Record<CookPreviewScrollTarget, string>> = {};
    const sectionIdForCookSource = (sourceId: CookSectionId) =>
      sections.find((section) => cookSourceBySectionId.get(section.id) === sourceId)?.id;

    const sectionIdForTitle = (title: string) =>
      sections.find(
        (section) =>
          section.type === 'category-showcase' &&
          'title' in section.settings &&
          section.settings.title === title
      )?.id;

    const firstSectionMatching = (...predicates: Array<(section: (typeof sections)[number]) => boolean>) => {
      for (const predicate of predicates) {
        const match = sections.find(predicate);
        if (match) return match.id;
      }
      return undefined;
    };

    const primaryCategoryId =
      sectionIdForTitle(CATEGORY_SECTION_TITLES.primary) ??
      sectionIdForCookSource('categories') ??
      firstSectionMatching((section) => section.type === 'category-showcase');

    targets.category = primaryCategoryId;

    targets['product-card'] =
      sectionIdForCookSource('trending-products') ??
      firstSectionMatching(
        (section) => section.type === 'featured-products',
        (section) => section.type === 'product-grid'
      );

    targets.button =
      sectionIdForCookSource('hero-banner') ??
      firstSectionMatching(
        (section) => section.type === 'banner' && section.settings?.height === 'large',
        (section) => section.type === 'banner',
        (section) => section.type === 'cta',
        (section) => section.type === 'feature-card'
      );

    return targets;
  }, [sections, cookSourceBySectionId]);

  useEffect(() => {
    if (!scrollFocus) {
      prevScrollFocusRef.current = null;
    }
  }, [scrollFocus]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    pinPreviewScrollX(scrollEl);
  }, [layout, heroHeaderOverlay, storefront.headerVariant, storefront.footerVariant]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const onScroll = () => {
      if (programmaticScrollRef.current || !scrollFocus) return;
      onManualScroll?.();
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [scrollFocus, onManualScroll]);

  useEffect(() => {
    if (!scrollFocus || scrollRequest === prevScrollRequestRef.current) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const focusChanged = prevScrollFocusRef.current !== scrollFocus;
    prevScrollFocusRef.current = scrollFocus;
    prevScrollRequestRef.current = scrollRequest;

    const behavior: ScrollBehavior = focusChanged ? 'smooth' : 'auto';
    let cancelled = false;

    const runScroll = () => {
      if (cancelled) return;

      const shouldSkip =
        scrollFocus !== 'category' &&
        !focusChanged &&
        isPreviewTargetInView(scrollEl, scrollFocus);

      if (shouldSkip) {
        return;
      }

      runPreviewAnchor(scrollEl, scrollFocus, behavior, programmaticScrollRef);

      if (focusChanged && scrollFocus === 'header') {
        settlePreviewAnchor(scrollEl, scrollFocus, programmaticScrollRef, () => cancelled);
      }
    };

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runScroll);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [scrollFocus, scrollRequest]);

  const layoutAnchorSnapshotRef = useRef({
    heroHeaderOverlay,
    headerVariant: siteSettings?.headerVariant,
    footerVariant: siteSettings?.footerVariant,
  });

  useEffect(() => {
    if (!scrollFocus) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const prev = layoutAnchorSnapshotRef.current;
    let layoutShifted = false;

    if (scrollFocus === 'header') {
      layoutShifted =
        prev.heroHeaderOverlay !== heroHeaderOverlay ||
        prev.headerVariant !== siteSettings?.headerVariant;
    } else if (scrollFocus === 'footer') {
      layoutShifted = prev.footerVariant !== siteSettings?.footerVariant;
    }

    layoutAnchorSnapshotRef.current = {
      heroHeaderOverlay,
      headerVariant: siteSettings?.headerVariant,
      footerVariant: siteSettings?.footerVariant,
    };

    if (!layoutShifted) return;

    let cancelled = false;
    const runAnchor = () => {
      if (cancelled) return;
      if (isPreviewTargetInView(scrollEl, scrollFocus)) return;
      runPreviewAnchor(scrollEl, scrollFocus, 'smooth', programmaticScrollRef);
    };

    const delayMs = scrollFocus === 'header' ? 80 : 0;
    const timeout = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(runAnchor);
        if (scrollFocus === 'header') {
          settlePreviewAnchor(scrollEl, scrollFocus, programmaticScrollRef, () => cancelled);
        }
      });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [scrollFocus, heroHeaderOverlay, siteSettings?.headerVariant, siteSettings?.footerVariant]);

  return (
    <aside className="cook-theme-preview-pane" aria-label="Store preview">
      <div className="cook-theme-preview-pane__head">
        <span className="cook-theme-preview-pane__title">Live preview</span>
        <span className="cook-theme-preview-pane__step">
          {activeStep ? `Step: ${activeStep}` : 'Desktop'} · {sectionCount} sections · {pageCount} pages
        </span>
      </div>

      <div className="cook-theme-preview-frame">
        <div className="cook-theme-preview-browser">
          <div className="cook-theme-preview-browser__bar" aria-hidden>
            <span />
            <span />
            <span />
            <span className="cook-theme-preview-browser__bar-label">{storeName} — desktop preview</span>
          </div>
          <div className="cook-theme-preview-scroll" ref={scrollRef}>
            <div
              className={`cook-theme-preview-viewport sites-page-frame viewport-desktop${
                heroHeaderOverlay ? ' cook-theme-preview-viewport--hero-overlay' : ''
              }`}
              onClickCapture={preventBuilderLinkNavigation}
              style={{
                color: layout.theme.textColor || '#1f2937',
                background: layout.theme.backgroundColor || '#ffffff',
                fontFamily: layout.theme.fontFamily || 'DM Sans, system-ui, sans-serif',
                ['--site-primary' as string]: layout.theme.primaryColor || '#1a73e8',
              }}
            >
              <div className="cook-theme-preview-scale">
                <div
                  className={`grid-canvas-container sites-canvas${
                    overlayHeaderInEditor ? ' sites-canvas--overlay-header' : ''
                  }${heroHeaderOverlay ? ' sites-canvas--hero-overlay' : ''}`}
                >
                {siteSettings ? (
                  <div className="grid-canvas-chrome">
                    <span
                      className="cook-preview-scroll-anchor"
                      data-cook-preview-target="header"
                      data-cook-preview-first="true"
                      aria-hidden
                    />
                    <StorefrontSiteHeader
                      siteSettings={siteSettings}
                      preview
                      heroOverlay={heroHeaderOverlay}
                    />
                  </div>
                ) : null}
                <div className="grid-canvas-stage">
                  {sections.length === 0 ? (
                    <div className="preview-empty">
                      <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>👀</p>
                      <p>Select sections to preview your store</p>
                    </div>
                  ) : (
                    <main className="preview-document-stack">
                      {sections.map((section) => {
                        const previewTarget = (
                          Object.entries(sectionScrollTargets) as Array<[CookPreviewScrollTarget, string]>
                        ).find(([, id]) => id === section.id)?.[0];

                        return (
                          <div
                            key={section.id}
                            style={getBlockRowStyle(section.blockLayout)}
                            {...(previewTarget
                              ? {
                                  'data-cook-preview-section-row': 'true',
                                  'data-cook-preview-target': previewTarget,
                                  'data-cook-preview-first': 'true',
                                }
                              : {})}
                          >
                            <div style={getBlockInnerStyle(section.blockLayout)}>
                              <SectionRenderer
                                section={section}
                                theme={layout.theme}
                                editMode={false}
                                builderCanvas
                              />
                            </div>
                          </div>
                        );
                      })}
                    </main>
                  )}
                  {siteSettings && sections.length > 0 ? (
                    <div className="sites-editor-footer-preview">
                      <span
                        className="cook-preview-scroll-anchor"
                        data-cook-preview-target="footer"
                        data-cook-preview-first="true"
                        aria-hidden
                      />
                      <WebsiteFooter siteSettings={siteSettings} previewMode />
                    </div>
                  ) : null}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="cook-theme-preview-note">
        Scaled desktop preview with your store data. Scroll to see the full page — fine-tune everything later in the
        builder.
      </p>
    </aside>
  );
}
