import { normalizeOrderQuantityStep } from '../../config/catalogueProductUtils';

export const CheckoutIconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const CheckoutIconImg = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const CheckoutIconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function CheckoutQtyControl({
  value,
  step,
  onChange,
  accent = false,
}: {
  value: number;
  step: number;
  onChange: (d: number) => void;
  accent?: boolean;
}) {
  const s = normalizeOrderQuantityStep(step);
  return (
    <div className={`sv-qty${accent ? ' accent' : ''}`}>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(-s)}>
        −
      </button>
      <span className="sv-qty-val">{value}</span>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(s)}>
        +
      </button>
    </div>
  );
}

export function CheckoutVariantPills({ summary }: { summary: string }) {
  const parts = summary.split(/;\s*/).filter(Boolean);
  return (
    <div className="sv-variant-pills">
      {parts.map((part) => (
        <span key={part} className="sv-variant-pill">
          {part}
        </span>
      ))}
    </div>
  );
}

export function CheckoutStepBar({ current }: { current: 'customer' | 'review' }) {
  const done = current === 'review';
  return (
    <div className="sv-steps">
      <div className="sv-step-item">
        <div className="sv-step-num done">
          <CheckoutIconCheck />
        </div>
        <span className="sv-step-label done">Items</span>
      </div>
      <div className="sv-step-line done" />
      <div className="sv-step-item">
        <div className={`sv-step-num${current === 'customer' ? ' active' : done ? ' done' : ''}`}>
          {done ? <CheckoutIconCheck /> : '2'}
        </div>
        <span className={`sv-step-label${current === 'customer' ? ' active' : done ? ' done' : ''}`}>
          Details
        </span>
      </div>
      <div className={`sv-step-line${done ? ' done' : ''}`} />
      <div className="sv-step-item">
        <div className={`sv-step-num${current === 'review' ? ' active' : ''}`}>3</div>
        <span className={`sv-step-label${current === 'review' ? ' active' : ''}`}>Review</span>
      </div>
    </div>
  );
}
