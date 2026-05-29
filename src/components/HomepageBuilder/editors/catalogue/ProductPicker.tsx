import React, { useMemo, useState } from 'react';
import { useBuilderCatalogue } from '../../catalogue/BuilderCatalogueContext';
import { getWebsiteProductImageUrl } from '../../../../utils/websiteStorefront';

interface ProductPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function ProductPicker({ selectedIds, onChange }: ProductPickerProps) {
  const { products, loading, error, reload } = useBuilderCatalogue();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(q));
  }, [products, query]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return <p className="catalogue-picker-hint">Loading products…</p>;
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
  if (products.length === 0) {
    return (
      <p className="catalogue-picker-hint">
        No products found in your catalogue yet. Add products to your store to feature them here.
      </p>
    );
  }

  return (
    <div className="catalogue-picker">
      <input
        type="text"
        className="panel-input"
        placeholder="Search products…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="catalogue-picker-meta">
        <span>{selectedIds.length} selected</span>
        {selectedIds.length > 0 && (
          <button type="button" className="btn-text" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
      <div className="catalogue-picker-list">
        {filtered.map((product) => {
          const checked = selectedIds.includes(product.id);
          const img = getWebsiteProductImageUrl(product);
          return (
            <button
              key={product.id}
              type="button"
              className={`catalogue-picker-item ${checked ? 'selected' : ''}`}
              onClick={() => toggle(product.id)}
            >
              <span className="catalogue-picker-thumb">
                {img ? <img src={img} alt={product.name} loading="lazy" /> : <span>📦</span>}
              </span>
              <span className="catalogue-picker-name">{product.name || 'Untitled product'}</span>
              <span className="catalogue-picker-check">{checked ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
