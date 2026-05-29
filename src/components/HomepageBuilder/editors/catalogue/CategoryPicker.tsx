import React from 'react';
import { useBuilderCatalogue } from '../../catalogue/BuilderCatalogueContext';

interface CategoryPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** When false, allow selecting multiple categories. */
  single?: boolean;
}

export default function CategoryPicker({ selectedIds, onChange, single = false }: CategoryPickerProps) {
  const { categories, loading, error, reload } = useBuilderCatalogue();

  const toggle = (id: string) => {
    if (single) {
      onChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return <p className="catalogue-picker-hint">Loading categories…</p>;
  }
  if (error) {
    return (
      <div className="catalogue-picker-error">
        <p className="catalogue-picker-hint error">{error}</p>
        <button type="button" className="btn-secondary" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }
  if (categories.length === 0) {
    return (
      <p className="catalogue-picker-hint">
        No categories found. Add a category to your products to group them here.
      </p>
    );
  }

  return (
    <div className="catalogue-picker">
      <div className="catalogue-picker-meta">
        <span>{selectedIds.length} selected</span>
        {selectedIds.length > 0 && (
          <button type="button" className="btn-text" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
      <div className="catalogue-picker-list">
        {categories.map((category) => {
          const checked = selectedIds.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              className={`catalogue-picker-item ${checked ? 'selected' : ''}`}
              onClick={() => toggle(category.id)}
            >
              <span className="catalogue-picker-thumb">
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.label} loading="lazy" />
                ) : (
                  <span>🏷️</span>
                )}
              </span>
              <span className="catalogue-picker-name">
                {category.label}
                <small className="catalogue-picker-count">{category.count} items</small>
              </span>
              <span className="catalogue-picker-check">{checked ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
