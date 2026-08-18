import { useMemo, useState } from 'react';
import { useBuilderCatalogue } from '../../catalogue/BuilderCatalogueContext';
import CataloguePickerModal from './CataloguePickerModal';

interface CategoryPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** When true, only one category can be selected. */
  single?: boolean;
}

function CategoryPickerList({
  selectedIds,
  onChange,
  single,
  query,
  onQueryChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  single: boolean;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const { categories } = useBuilderCatalogue();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, query]);

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

  if (filtered.length === 0) {
    return <p className="catalogue-picker-hint">No categories match your search.</p>;
  }

  return (
    <>
      <input
        type="text"
        className="panel-input"
        placeholder="Search categories…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoFocus
      />
      <div className="catalogue-picker-meta">
        <span>
          {single
            ? selectedIds.length
              ? '1 selected'
              : 'None selected'
            : `${selectedIds.length} selected`}
        </span>
        {selectedIds.length > 0 ? (
          <button type="button" className="btn-text" onClick={() => onChange([])}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="catalogue-picker-list catalogue-picker-list--modal">
        {filtered.map((category) => {
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
                  <img src={category.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden>🏷️</span>
                )}
              </span>
              <span className="catalogue-picker-name">
                {category.label}
                <small className="catalogue-picker-count">{category.count} items</small>
              </span>
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

export default function CategoryPicker({ selectedIds, onChange, single = false }: CategoryPickerProps) {
  const { categories, loading, error, reload } = useBuilderCatalogue();
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
    if (selectedIds.length === 0) {
      return single ? 'Choose category…' : 'Choose categories…';
    }
    return `${selectedIds.length} categories selected`;
  }, [selectedIds, single]);

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
    <div className="catalogue-picker-field">
      <button
        type="button"
        className="btn-secondary catalogue-picker-trigger catalogue-picker-trigger--highlight"
        onClick={openModal}
      >
        {summary}
      </button>

      {open ? (
        <CataloguePickerModal
          title={single ? 'Select category' : 'Select categories'}
          onClose={closeModal}
          onDone={apply}
          doneLabel="Select"
        >
          <CategoryPickerList
            selectedIds={draftIds}
            onChange={setDraftIds}
            single={single}
            query={query}
            onQueryChange={setQuery}
          />
        </CataloguePickerModal>
      ) : null}
    </div>
  );
}
