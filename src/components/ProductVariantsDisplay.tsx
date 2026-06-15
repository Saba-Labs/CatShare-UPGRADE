import React from "react";
import {
  formatVariantOptions,
  type ProductVariantGroup,
} from "../utils/productVariants";
import "./ProductVariantsDisplay.css";

type Props = {
  groups: ProductVariantGroup[];
  /** readonly = chips only; select = shopper picks one per group */
  mode?: "readonly" | "select";
  selection?: Record<string, string>;
  onSelect?: (groupId: string, option: string) => void;
  className?: string;
  error?: boolean;
  /** Tighter inline layout for list rows (e.g. create order) */
  compact?: boolean;
  /** When false, option chip is faded and not selectable (e.g. out of stock). */
  isOptionAvailable?: (groupId: string, option: string) => boolean;
};

export default function ProductVariantsDisplay({
  groups,
  mode = "readonly",
  selection = {},
  onSelect,
  className = "",
  error = false,
  compact = false,
  isOptionAvailable,
}: Props) {
  if (!groups.length) return null;

  return (
    <div className={`pvd${compact ? " pvd--compact" : ""} ${error ? " pvd--error" : ""} ${className}`.trim()}>
      {groups.map((group) => (
        <div key={group.id} className="pvd-group">
          <div className="pvd-group-name">{group.name}</div>
          <div className="pvd-options">
            {mode === "select" ? (
              group.options.map((opt) => {
                const active = selection[group.id] === opt;
                const available = isOptionAvailable ? isOptionAvailable(group.id, opt) : true;
                const unavailable = !available;
                return (
                  <button
                    key={`${group.id}-${opt}`}
                    type="button"
                    className={`pvd-chip pvd-chip--btn${active ? " pvd-chip--active" : ""}${unavailable ? " pvd-chip--unavailable" : ""}`}
                    disabled={unavailable && !active}
                    aria-disabled={unavailable}
                    title={unavailable ? "Out of stock" : undefined}
                    onClick={() => {
                      if (!unavailable) onSelect?.(group.id, opt);
                    }}
                  >
                    {opt}
                  </button>
                );
              })
            ) : (
              <span className="pvd-chip pvd-chip--readonly">
                {formatVariantOptions(group.options)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
