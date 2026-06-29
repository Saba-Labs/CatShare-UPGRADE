import './BuilderMobileGate.css';
import { getPublicWebBaseUrl } from '../../utils/publicWebBaseUrl';

interface BuilderMobileGateProps {
  onClose: () => void;
}

function getBuilderAppHost(): string {
  try {
    return new URL(getPublicWebBaseUrl()).host;
  } catch {
    return 'my.catshare.app';
  }
}

const BUILDER_APP_URL = getPublicWebBaseUrl();
const BUILDER_APP_HOST = getBuilderAppHost();

export default function BuilderMobileGate({ onClose }: BuilderMobileGateProps) {
  return (
    <div className="builder-mobile-gate">
      <div className="builder-mobile-gate__bg" aria-hidden>
        <div className="builder-mobile-gate__orb builder-mobile-gate__orb--1" />
        <div className="builder-mobile-gate__orb builder-mobile-gate__orb--2" />
        <div className="builder-mobile-gate__grid" />
      </div>

      <div className="builder-mobile-gate__content">
        <div className="builder-mobile-gate__mockup" aria-hidden>
          <div className="builder-mobile-gate__laptop">
            <div className="builder-mobile-gate__screen">
              <div className="builder-mobile-gate__chrome">
                <span className="builder-mobile-gate__dot" />
                <span className="builder-mobile-gate__dot" />
                <span className="builder-mobile-gate__dot" />
                <span className="builder-mobile-gate__url">{BUILDER_APP_HOST} · Site editor</span>
              </div>
              <div className="builder-mobile-gate__editor">
                <div className="builder-mobile-gate__toolbar">
                  <span className="builder-mobile-gate__toolbar-pill" />
                  <span className="builder-mobile-gate__toolbar-pill builder-mobile-gate__toolbar-pill--accent" />
                </div>
                <div className="builder-mobile-gate__workspace">
                  <div className="builder-mobile-gate__canvas">
                    <div className="builder-mobile-gate__block builder-mobile-gate__block--hero" />
                    <div className="builder-mobile-gate__block-row">
                      <div className="builder-mobile-gate__block builder-mobile-gate__block--sm" />
                      <div className="builder-mobile-gate__block builder-mobile-gate__block--sm" />
                    </div>
                    <div className="builder-mobile-gate__block builder-mobile-gate__block--wide" />
                  </div>
                  <div className="builder-mobile-gate__sidebar">
                    <div className="builder-mobile-gate__sidebar-tab" />
                    <div className="builder-mobile-gate__sidebar-card" />
                    <div className="builder-mobile-gate__sidebar-card builder-mobile-gate__sidebar-card--short" />
                  </div>
                </div>
              </div>
            </div>
            <div className="builder-mobile-gate__base" />
          </div>
          <div className="builder-mobile-gate__cursor">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1a73e8" aria-hidden>
              <path d="M5 3l14 9-6.5 1.5L11 21 5 3z" />
            </svg>
          </div>
        </div>

        <div className="builder-mobile-gate__card">
          <span className="builder-mobile-gate__badge">Desktop browser</span>
          <h1 className="builder-mobile-gate__title">Design your store on a bigger screen</h1>
          <p className="builder-mobile-gate__lead">
            The site editor is built for laptops and tablets — not small phone screens.
          </p>

          <div className="builder-mobile-gate__url-callout">
            <a
              href={BUILDER_APP_URL}
              className="builder-mobile-gate__url-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {BUILDER_APP_HOST}
            </a>
            <p className="builder-mobile-gate__url-note">
              On a computer or tablet, visit this link and sign in with your CatShare account to use
              the homepage editor.
            </p>
          </div>

          <div className="builder-mobile-gate__actions">
            <button type="button" className="builder-mobile-gate__btn-primary" onClick={onClose}>
              Back to Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
