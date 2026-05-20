import React, { useState } from "react";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ groupIndex: number; optionIndex: number } | null>(null);
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
    setConfirmDelete({ groupIndex, optionIndex });
  };

  const confirmRemoveOption = () => {
    if (!confirmDelete) return;
    const { groupIndex, optionIndex } = confirmDelete;
    const g = groups[groupIndex];
    if (!g) return;
    const options = g.options.filter((_, i) => i !== optionIndex);
    updateGroup(groupIndex, { options: options.length > 0 ? options : [""] });
    setConfirmDelete(null);
  };

  const removeGroup = (index: number) => {
    const filtered = groups.filter((_, i) => i !== index);
    onChange(filtered);
    if (currentIndex >= filtered.length && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const addGroup = () => {
    if (groups.length >= MAX_VARIANT_GROUPS) return;
    onChange([...groups, createEmptyVariantGroup("")]);
    setCurrentIndex(groups.length);
  };

  const goToPrevious = () => {
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex(Math.min(groups.length - 1, currentIndex + 1));
  };

  const currentGroup = groups[currentIndex];
  const hasGroups = groups.length > 0;

  return (
    <div className={rootClass}>
      {hasGroups && (
        <div className="pve-tabs-wrapper">
          <div className="pve-tabs">
            {groups.map((group, idx) => (
              <button
                key={group.id}
                type="button"
                className={`pve-tab ${idx === currentIndex ? 'pve-tab--active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
              >
                {group.name || `Group ${idx + 1}`}
              </button>
            ))}
            <button
              type="button"
              className="pve-tab-add"
              onClick={addGroup}
              disabled={groups.length >= MAX_VARIANT_GROUPS}
              aria-label="Add variant group"
            >
              <svg className="pve-tab-add-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!hasGroups && (
        <button
          type="button"
          className="pve-add-group-empty"
          onClick={addGroup}
        >
          + Add variant group
        </button>
      )}

      {hasGroups && (
        <div className="pve-partition-view">
          <div className="pve-group-card">
            <div className="pve-group-head">
              <label className="pve-label">Group name</label>
              <div className="pve-group-head-input-wrapper">
                <input
                  type="text"
                  className="pve-input"
                  placeholder="e.g. Size or Colour"
                  value={currentGroup.name}
                  onChange={(e) => updateGroup(currentIndex, { name: e.target.value })}
                  maxLength={48}
                />
                <button
                  type="button"
                  className="pve-remove-group"
                  onClick={() => removeGroup(currentIndex)}
                  aria-label="Remove variant group"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <label className="pve-label">Options</label>
            <div className="pve-options">
              {currentGroup.options.map((opt, oi) => (
                <div key={`${currentGroup.id}-opt-${oi}`} className="pve-option-row">
                  <input
                    type="text"
                    className="pve-input pve-input--option"
                    placeholder={oi === 0 ? "e.g. Small" : "Another option"}
                    value={opt}
                    onChange={(e) => updateOption(currentIndex, oi, e.target.value)}
                    maxLength={64}
                  />
                  <button
                    type="button"
                    className="pve-icon-btn"
                    onClick={() => removeOption(currentIndex, oi)}
                    disabled={currentGroup.options.length <= 1}
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {currentGroup.options.length < MAX_VARIANT_OPTIONS_PER_GROUP && (
              <button
                type="button"
                className="pve-add-option"
                onClick={() => addOption(currentIndex)}
              >
                <svg className="pve-add-option-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add option
              </button>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="pve-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="pve-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pve-modal-title">Delete Option</h3>
            <p className="pve-modal-text">Are you sure you want to delete this option? This action cannot be undone.</p>
            <div className="pve-modal-buttons">
              <button
                type="button"
                className="pve-modal-btn pve-modal-btn--cancel"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pve-modal-btn pve-modal-btn--delete"
                onClick={confirmRemoveOption}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
