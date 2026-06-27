import { useEffect, useMemo } from 'react';
import { FiClock } from 'react-icons/fi';
import WarehouseShell from './components/WarehouseShell';
import { useWarehouse } from './WarehouseContext';
import {
  formatHistoryDateLabel,
  groupMovementsByDate,
  resolveStockLineLabels,
} from './warehouseUtils';

export default function WarehouseHistory() {
  const { loading, error, movements, productById, roomNameById, refreshMovements } =
    useWarehouse();

  const movementsByDate = useMemo(() => groupMovementsByDate(movements), [movements]);

  useEffect(() => {
    void refreshMovements();
  }, [refreshMovements]);

  if (loading) {
    return (
      <WarehouseShell title="History">
        <div className="wh-spinner" />
      </WarehouseShell>
    );
  }

  return (
    <WarehouseShell title="History">
      {error ? <div className="wh-error">{error}</div> : null}

      <p className="wh-page-lead">Recent stock adjustments and order deductions.</p>

      {movements.length === 0 ? (
        <div className="wh-card wh-empty">
          <div className="wh-empty-icon">
            <FiClock size={22} />
          </div>
          No movements yet.
        </div>
      ) : (
        <div>
          {movementsByDate.map(([dateKey, dayMovements]) => (
            <div key={dateKey} className="wh-history-day">
              <div className="wh-history-date">{formatHistoryDateLabel(dateKey)}</div>
              <div className="wh-history-card">
                {dayMovements.map((m) => {
                  const { productName, productSubtitle, variantLabel } = resolveStockLineLabels(
                    m.productId,
                    m.variantCombinationId,
                    productById
                  );
                  const roomName = roomNameById.get(m.inventoryId) ?? 'Inventory';
                  return (
                    <div key={m.id} className="wh-list-item">
                      <div style={{ minWidth: 0 }}>
                        <div className="wh-label">{productName}</div>
                        {productSubtitle ? <div className="wh-sub">{productSubtitle}</div> : null}
                        <div className="wh-history-pills">
                          {variantLabel ? (
                            <span className="wh-variant-pill">{variantLabel}</span>
                          ) : null}
                          <span className="wh-room-pill">{roomName}</span>
                        </div>
                      </div>
                      <div className="wh-qty-side">
                        <div
                          className="wh-qty-side-val"
                          style={{ color: m.delta < 0 ? '#c0392b' : '#1a7a4a' }}
                        >
                          {m.delta > 0 ? '+' : ''}
                          {m.delta}
                        </div>
                        <div className="wh-qty-side-lbl">change</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </WarehouseShell>
  );
}
