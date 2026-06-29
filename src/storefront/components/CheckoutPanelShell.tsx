import type { CSSProperties, ReactNode } from 'react';
import { CheckoutIconBack, CheckoutStepBar } from './CheckoutUi';

export type CheckoutPanelStep = 'customer' | 'review';

interface CheckoutPanelShellProps {
  step: CheckoutPanelStep;
  websiteCheckoutClass?: string;
  websiteCheckoutTheme?: CSSProperties;
  onBack: () => void;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  primaryLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function CheckoutPanelShell({
  step,
  websiteCheckoutClass = '',
  websiteCheckoutTheme,
  onBack,
  onPrimaryAction,
  primaryDisabled,
  primaryLabel,
  children,
  footer,
}: CheckoutPanelShellProps) {
  const isDetails = step === 'customer';

  return (
    <div
      className={`sv-panel sv-checkout-panel${isDetails ? ' sv-checkout-panel--details' : ''}${websiteCheckoutClass ? ` ${websiteCheckoutClass}` : ''}`}
      style={websiteCheckoutTheme}
    >
      <div className="sv-checkout-shell">
        <div className="sv-panel-header">
          <button type="button" className="sv-panel-back" onClick={onBack} aria-label="Go back">
            <CheckoutIconBack />
          </button>
          <div className="sv-panel-title-wrap">
            <div className="sv-panel-title">{isDetails ? 'Your details' : 'Review order'}</div>
            <div className="sv-panel-subtitle">
              {isDetails ? 'Almost there — just a few details' : 'Confirm everything looks right'}
            </div>
          </div>
          <button className="sv-panel-cta" onClick={onPrimaryAction} disabled={primaryDisabled}>
            {primaryLabel}
          </button>
        </div>

        <div className="sv-checkout-steps">
          <CheckoutStepBar current={step} />
        </div>

        {children}

        {isDetails ? (
          <div className="sv-checkout-mobile-cta">
            <button type="button" className="sv-panel-cta" onClick={onPrimaryAction} disabled={primaryDisabled}>
              {primaryLabel}
            </button>
          </div>
        ) : null}

        {footer}
      </div>
    </div>
  );
}
