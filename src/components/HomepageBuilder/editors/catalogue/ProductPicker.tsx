import { useMemo, useState } from 'react';
import { useBuilderCatalogue } from '../../catalogue/BuilderCatalogueContext';
import { getWebsiteProductImageUrl } from '../../../../utils/websiteStorefront';
import CataloguePickerModal from './CataloguePickerModal';

interface ProductPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function ProductPickerList({
  selectedIds,
  onChange,
  query,
  onQueryChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const { products } = useBuilderCatalogue();

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

  if (filtered.length === 0) {
    return <p className="catalogue-picker-hint">No products match your search.</p>;
  }

  return (
    <>
      <input
        type="text"
        className="panel-input"
        placeholder="Search products…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoFocus
      />
      <div className="catalogue-picker-meta">
        <span>{selectedIds.length} selected</span>
        {selectedIds.length > 0 ? (
          <button type="button" className="btn-text" onClick={() => onChange([])}>
            Clear all
          </button>
        ) : null}
      </div>
      <div className="catalogue-picker-list catalogue-picker-list--modal">
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
                {img ? <img src={img} alt="" loading="lazy" /> : <span aria-hidden>📦</span>}
              </span>
              <span className="catalogue-picker-name">{product.name || 'Untitled product'}</span>
              <span className="catalogue-picker-check" aria-hidden>
                {checked ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function ProductPicker({ selectedIds, onChange }: ProductPickerProps) {
  const { products, loading, error, reload } = useBuilderCatalogue();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');

  const openModal = () => {
    setDraftIds(selectedIds);
    setQuery('');
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setQuery('');
  };

  const apply = () => {
    onChange(draftIds);
    closeModal();
  };

  const summary = useMemo(() => {
    if (selectedIds.length === 0) return 'Choose products…';
    if (selectedIds.length === 1) {
      const p = products.find((x) => x.id === selectedIds[0]);
      return p?.name || '1 product';
    }
    return `${selectedIds.length} products selected`;
  }, [selectedIds, products]);

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
    <div className="catalogue-picker-field">
      <button type="button" className="btn-secondary catalogue-picker-trigger" onClick={openModal}>
        {summary}
      </button>
      {selectedIds.length > 0 ? (
        <div className="catalogue-picker-summary-chips">
          {selectedIds.slice(0, 4).map((id) => {
            const p = products.find((x) => x.id === id);
            return (
              <span key={id} className="catalogue-picker-chip">
                {p?.name || 'Product'}
              </span>
            );
          })}
          {selectedIds.length > 4 ? (
            <span className="catalogue-picker-chip catalogue-picker-chip--more">
              +{selectedIds.length - 4} more
            </span>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <CataloguePickerModal title="Select products" onClose={closeModal} onDone={apply}>
          <ProductPickerList
            selectedIds={draftIds}
            onChange={setDraftIds}
            query={query}
            onQueryChange={setQuery}
          />
        </CataloguePickerModal>
      ) : null}
    </div>
  );
}
