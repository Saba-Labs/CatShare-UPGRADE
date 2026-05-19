import React from "react";
import {
  MAX_VARIANT_GROUPS,
  MAX_VARIANT_OPTIONS_PER_GROUP,
  type ProductVariantGroup,
  createEmptyVariantGroup,
} from "../utils/productVariants";
import "./ProductVariantsEditor.css";

type Props = {
  groups: ProductVariantGroup[];
  onChange: (groups: ProductVariantGroup[]) => void;
  /** classic = light gray panels; glass = frosted cards */
  theme?: "classic" | "glass";
};

export default function ProductVariantsEditor({
  groups,
  onChange,
  theme = "classic",
}: Props) {
  const rootClass =
    theme === "glass" ? "pve pve--glass" : "pve pve--classic";

  const updateGroup = (index: number, patch: Partial<ProductVariantGroup>) => {
    const next = groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
    onChange(next);
  };

  const updateOption = (groupIndex: number, optionIndex: number, value: string) => {
    const g = groups[groupIndex];
    if (!g) return;
    const options = [...g.options];
    options[optionIndex] = value;
    updateGroup(groupIndex, { options });
  };

  const addOption = (groupIndex: number) => {
    const g = groups[groupIndex];
    if (!g || g.options.length >= MAX_VARIANT_OPTIONS_PER_GROUP) return;
    updateGroup(groupIndex, { options: [...g.options, ""] });
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    const g = groups[groupIndex];
    if (!g) return;
    const options = g.options.filter((_, i) => i !== optionIndex);
    updateGroup(groupIndex, { options: options.length > 0 ? options : [""] });
  };

  const removeGroup = (index: number) => {
    onChange(groups.filter((_, i) => i !== index));
  };

  const addGroup = () => {
    if (groups.length >= MAX_VARIANT_GROUPS) return;
    onChange([...groups, createEmptyVariantGroup("")]);
  };

  return (
    <div className={rootClass}>
      <p className="pve-hint">
        Add option groups such as Size (S, M, L) or Colour (Red, Green). Shoppers
        see these on shared links, your online store, and PDF exports.
      </p>

      {groups.length === 0 && (
        <div className="pve-empty">
          No variants yet. Add a group to get started.
        </div>
      )}

      {groups.map((group, gi) => (
        <div key={group.id} className="pve-group">
          <div className="pve-group-head">
            <label className="pve-label">Group name</label>
            <input
              type="text"
              className="pve-input"
              placeholder="e.g. Size or Colour"
              value={group.name}
              onChange={(e) => updateGroup(gi, { name: e.target.value })}
              maxLength={48}
            />
            <button
              type="button"
              className="pve-remove-group"
              onClick={() => removeGroup(gi)}
              aria-label="Remove variant group"
            >
              Remove
            </button>
          </div>

          <label className="pve-label">Options</label>
          <div className="pve-options">
            {group.options.map((opt, oi) => (
              <div key={`${group.id}-opt-${oi}`} className="pve-option-row">
                <input
                  type="text"
                  className="pve-input pve-input--option"
                  placeholder={oi === 0 ? "e.g. Small" : "Another option"}
                  value={opt}
                  onChange={(e) => updateOption(gi, oi, e.target.value)}
                  maxLength={64}
                />
                <button
                  type="button"
                  className="pve-icon-btn"
                  onClick={() => removeOption(gi, oi)}
                  disabled={group.options.length <= 1}
                  aria-label="Remove option"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {group.options.length < MAX_VARIANT_OPTIONS_PER_GROUP && (
            <button
              type="button"
              className="pve-add-option"
              onClick={() => addOption(gi)}
            >
              + Add option
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="pve-add-group"
        onClick={addGroup}
        disabled={groups.length >= MAX_VARIANT_GROUPS}
      >
        + Add variant group
      </button>
    </div>
  );
}
