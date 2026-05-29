import './BuilderMobileGate.css';

interface BuilderMobileGateProps {
  onClose: () => void;
}

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    label: 'Drag-and-drop blocks',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    label: 'Live preview',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L6 21l2.3-7-6-4.6h7.6L12 2z" />
      </svg>
    ),
    label: 'Ready-made templates',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'Publish in one click',
  },
];

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
                <span className="builder-mobile-gate__url">catshare.app · Site editor</span>
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
          <span className="builder-mobile-gate__badge">Desktop experience</span>
          <h1 className="builder-mobile-gate__title">Design your store on a bigger screen</h1>
          <p className="builder-mobile-gate__lead">
            The visual site editor needs room for drag-and-drop, live preview, and fine-tuning. Open CatShare Sites on
            a laptop or tablet for the full experience.
          </p>

          <ul className="builder-mobile-gate__features">
            {FEATURES.map((f) => (
              <li key={f.label}>
                <span className="builder-mobile-gate__feature-icon">{f.icon}</span>
                {f.label}
              </li>
            ))}
          </ul>

          <div className="builder-mobile-gate__actions">
            <button type="button" className="builder-mobile-gate__btn-primary" onClick={onClose}>
              Back to my store
            </button>
            <p className="builder-mobile-gate__footnote">
              Tip: bookmark <strong>catshare.app</strong> on your computer to pick up where you left off.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
