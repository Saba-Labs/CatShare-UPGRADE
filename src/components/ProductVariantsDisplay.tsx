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
};

export default function ProductVariantsDisplay({
  groups,
  mode = "readonly",
  selection = {},
  onSelect,
  className = "",
}: Props) {
  if (!groups.length) return null;

  return (
    <div className={`pvd ${className}`.trim()}>
      {groups.map((group) => (
        <div key={group.id} className="pvd-group">
          <div className="pvd-group-name">{group.name}</div>
          <div className="pvd-options">
            {mode === "select" ? (
              group.options.map((opt) => {
                const active = selection[group.id] === opt;
                return (
                  <button
                    key={`${group.id}-${opt}`}
                    type="button"
                    className={`pvd-chip pvd-chip--btn${active ? " pvd-chip--active" : ""}`}
                    onClick={() => onSelect?.(group.id, opt)}
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
