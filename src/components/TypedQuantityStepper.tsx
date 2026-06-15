import React, { useEffect, useState } from 'react';

type TypedQuantityStepperProps = {
  value: number;
  onDraftChange: (quantity: number) => void;
  onBlurCommit?: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  /** Minus icon */
  renderMinus: React.ReactNode;
  /** Plus icon */
  renderPlus: React.ReactNode;
  containerStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  minusButtonStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
};

/**
 * Quantity stepper with typed input: allows free digit entry while focused;
 * parent should apply MOQ/step/stock rules on blur via onBlurCommit.
 */
export default function TypedQuantityStepper({
  value,
  onDraftChange,
  onBlurCommit,
  onDecrement,
  onIncrement,
  decrementDisabled = false,
  renderMinus,
  renderPlus,
  containerStyle,
  buttonStyle,
  minusButtonStyle,
  inputStyle,
}: TypedQuantityStepperProps) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value > 0 ? String(value) : '');
    }
  }, [value, focused]);

  const displayValue = focused ? draft : value > 0 ? String(value) : '';

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={decrementDisabled}
        style={{ ...buttonStyle, ...minusButtonStyle }}
      >
        {renderMinus}
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onFocus={() => {
          setFocused(true);
          setDraft(value > 0 ? String(value) : '');
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          setDraft(digits);
          onDraftChange(digits ? parseInt(digits, 10) : 0);
        }}
        onBlur={() => {
          setFocused(false);
          onBlurCommit?.();
        }}
        aria-label="Quantity"
        style={inputStyle}
      />
      <button type="button" onClick={onIncrement} style={buttonStyle}>
        {renderPlus}
      </button>
    </div>
  );
}
