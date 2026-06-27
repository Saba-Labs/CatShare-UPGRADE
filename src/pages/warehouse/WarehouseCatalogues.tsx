import type { CSSProperties } from 'react';
import { FiBookOpen, FiLink, FiLink2 } from 'react-icons/fi';
import WarehouseShell from './components/WarehouseShell';
import { useWarehouse } from './WarehouseContext';
import { getCardAccent } from './warehouseUtils';

export default function WarehouseCatalogues() {
  const { loading, error, catalogues, rooms, linkCatalogue, roomNameById } = useWarehouse();

  if (loading) {
    return (
      <WarehouseShell title="Catalogues">
        <div className="wh-spinner" />
      </WarehouseShell>
    );
  }

  return (
    <WarehouseShell title="Catalogues">
      {error ? <div className="wh-error">{error}</div> : null}

      <p className="wh-page-lead">
        Each catalogue sells from one inventory. Orders deduct stock from the linked space.
      </p>

      <div className="wh-catalogue-grid">
        {catalogues.map((cat, index) => {
          const accent = getCardAccent(cat.id, index);
          const linkedRoom = cat.inventoryId ? roomNameById.get(cat.inventoryId) : null;
          const isLinked = Boolean(cat.inventoryId && linkedRoom);
          const showFolder =
            Boolean(cat.folder) &&
            cat.folder.trim().toLowerCase() !== cat.label.trim().toLowerCase();

          return (
            <article
              key={cat.id}
              className={`wh-catalogue-card${isLinked ? '' : ' wh-catalogue-card--unlinked'}`}
              style={
                {
                  '--cat-bg': accent.bg,
                  '--cat-border': accent.border,
                  '--cat-icon': accent.icon,
                  '--cat-stripe': accent.stripe,
                } as CSSProperties
              }
            >
              <div className="wh-catalogue-card__head">
                <span className="wh-catalogue-card__icon" aria-hidden>
                  <FiBookOpen size={20} />
                </span>
                <div className="wh-catalogue-card__titles">
                  <h2 className="wh-catalogue-card__name">{cat.label}</h2>
                  {showFolder ? (
                    <span className="wh-catalogue-card__folder">{cat.folder}</span>
                  ) : null}
                </div>
                <span
                  className={`wh-catalogue-card__status${isLinked ? ' linked' : ''}`}
                  title={isLinked ? 'Linked to inventory' : 'Not linked'}
                >
                  {isLinked ? <FiLink2 size={14} /> : <FiLink size={14} />}
                </span>
              </div>

              {cat.description ? (
                <p className="wh-catalogue-card__desc">{cat.description}</p>
              ) : null}

              <div className="wh-catalogue-card__link-row">
                <label className="wh-catalogue-card__label" htmlFor={`cat-inv-${cat.id}`}>
                  Stock from
                </label>
                <select
                  id={`cat-inv-${cat.id}`}
                  className="wh-select wh-catalogue-card__select"
                  value={cat.inventoryId ?? ''}
                  onChange={(e) => void linkCatalogue(cat.id, e.target.value)}
                >
                  <option value="">Not linked</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {isLinked ? (
                <p className="wh-catalogue-card__linked-pill">
                  Using <strong>{linkedRoom}</strong>
                </p>
              ) : (
                <p className="wh-catalogue-card__warn">No inventory — orders won&apos;t deduct stock</p>
              )}
            </article>
          );
        })}
      </div>
    </WarehouseShell>
  );
}
