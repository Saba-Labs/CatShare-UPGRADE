import React, { useEffect, useState } from 'react';
import { FiMinus, FiPlus } from 'react-icons/fi';

export const WAREHOUSE_QTY_STEPPER_CSS = `
  .wh-qty {
    display: flex; align-items: stretch; gap: 0; flex-shrink: 0;
    border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff;
    min-height: 44px;
  }
  .wh-qty-btn {
    width: 44px; min-width: 44px; height: 44px; border: none; background: #f8fafc; color: var(--text, #0f172a);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .wh-qty-btn:active:not(:disabled) { background: #e2e8f0; }
  .wh-qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .wh-qty-input {
    width: 52px; min-width: 52px; height: 44px; border: none;
    border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;
    text-align: center; font-size: 16px; font-weight: 700; font-family: inherit;
    color: var(--text, #0f172a); background: #fff; padding: 0 4px;
    -moz-appearance: textfield;
  }
  .wh-qty-input::-webkit-outer-spin-button,
  .wh-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .wh-qty-input:focus { outline: none; background: #f8fafc; }
  .wh-qty-input:disabled { opacity: 0.5; }
`;

export default function WarehouseQtyStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      setText('0');
      if (value !== 0) onChange(0);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(String(value));
      return;
    }
    const next = Math.floor(parsed);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <>
      <style>{WAREHOUSE_QTY_STEPPER_CSS}</style>
      <div
        className="wh-qty"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <button
          type="button"
          className="wh-qty-btn"
          aria-label="Decrease quantity"
          disabled={disabled || value <= 0}
          onClick={(e) => {
            e.stopPropagation();
            onChange(Math.max(0, value - 1));
          }}
        >
          <FiMinus size={16} />
        </button>
        <input
          type="number"
          className="wh-qty-input"
          min={0}
          step={1}
          inputMode="numeric"
          aria-label="Quantity"
          value={text}
          disabled={disabled}
          onFocus={(e) => {
            e.stopPropagation();
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onChange={(e) => setText(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className="wh-qty-btn"
          aria-label="Increase quantity"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onChange(value + 1);
          }}
        >
          <FiPlus size={16} />
        </button>
      </div>
    </>
  );
}
