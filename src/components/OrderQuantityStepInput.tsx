import React, { useEffect, useState } from "react";
import { normalizeOrderQuantityStep } from "../config/catalogueProductUtils";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "onBlur"
> & {
  /** Stored step (defaults applied via normalize on blur). */
  value: number;
  onCommit: (step: number) => void;
};

/**
 * Qty step: allows clearing the field while editing; on blur empty/invalid becomes 1.
 */
export default function OrderQuantityStepInput({
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
        setDraft(e.target.value.replace(/\D/g, ""));
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = normalizeOrderQuantityStep(draft);
        onCommit(next);
        setDraft(String(next));
      }}
      className={className}
    />
  );
}
