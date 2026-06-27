import { FiAlertTriangle } from 'react-icons/fi';
import WarehouseShell from './components/WarehouseShell';
import { useWarehouse } from './WarehouseContext';
import { resolveStockLineLabels } from './warehouseUtils';

export default function WarehouseDeadStock() {
  const { loading, error, deadStock, productById } = useWarehouse();

  if (loading) {
    return (
      <WarehouseShell title="Dead stock">
        <div className="wh-spinner" />
      </WarehouseShell>
    );
  }

  return (
    <WarehouseShell title="Dead stock">
      {error ? <div className="wh-error">{error}</div> : null}

      <p className="wh-page-lead">
        Units in inventories that are not linked to any catalogue. Link a catalogue or move stock
        to sell it.
      </p>

      <div className="wh-card">
        {deadStock.length === 0 ? (
          <div className="wh-empty">
            <div className="wh-empty-icon">
              <FiAlertTriangle size={22} />
            </div>
            No unsellable stock in unlinked inventories.
          </div>
        ) : (
          deadStock.map((line, i) => {
            const { productName, productSubtitle, variantLabel } = resolveStockLineLabels(
              line.productId,
              line.variantCombinationId,
              productById
            );
            return (
              <div key={`${line.inventoryId}-${line.productId}-${i}`} className="wh-list-item">
                <div style={{ minWidth: 0 }}>
                  <div className="wh-label">{productName}</div>
                  {productSubtitle ? <div className="wh-sub">{productSubtitle}</div> : null}
                  <div className="wh-history-pills">
                    {variantLabel ? (
                      <span className="wh-variant-pill">{variantLabel}</span>
                    ) : null}
                    <span className="wh-room-pill">{line.inventoryName}</span>
                  </div>
                </div>
                <div className="wh-qty-side">
                  <div className="wh-qty-side-val">{line.onHand}</div>
                  <div className="wh-qty-side-lbl">units</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </WarehouseShell>
  );
}
