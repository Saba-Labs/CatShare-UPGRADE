import React, { useEffect, useState } from 'react';
import { normalizeMinimumOrderQuantity } from '../utils/quantityPricingUtils';

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'onBlur'
> & {
  value: number;
  onCommit: (moq: number) => void;
};

/** MOQ: empty/invalid on blur becomes 1 (no extra minimum beyond qty step). */
export default function MinimumOrderQuantityInput({
  value,
  onCommit,
  className,
  onKeyDown,
  ...rest
}: Props) {
  const [draft, setDraft] = useState(() => String(value ?? 1));

  useEffect(() => {
    setDraft(String(value ?? 1));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value.replace(/\D/g, ''));
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = normalizeMinimumOrderQuantity(draft);
        onCommit(next);
        setDraft(String(next));
      }}
      className={className}
    />
  );
}
