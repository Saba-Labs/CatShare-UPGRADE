import {
  createManualAdjustment,
  parseManualAdjustmentAmount,
  type ManualOrderAdjustment,
} from '../utils/manualOrderAdjustments';
import './manual-order-adjustments.css';

type Props = {
  adjustments: ManualOrderAdjustment[];
  onChange: (next: ManualOrderAdjustment[]) => void;
};

function updateAdjustment(
  rows: ManualOrderAdjustment[],
  id: string,
  patch: Partial<ManualOrderAdjustment>
): ManualOrderAdjustment[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export default function ManualOrderAdjustmentsEditor({
  adjustments,
  onChange,
}: Props) {
  const addAdjustment = (kind: 'discount' | 'charge') => {
    onChange([...adjustments, createManualAdjustment(kind)]);
  };

  return (
    <div className="moa-card">
      <div className="moa-toolbar">
        <span className="moa-title">Adjustments</span>
        <div className="moa-toolbar__actions">
          <button type="button" className="moa-add moa-add--discount" onClick={() => addAdjustment('discount')}>
            + Discount
          </button>
          <button type="button" className="moa-add moa-add--charge" onClick={() => addAdjustment('charge')}>
            + Charge
          </button>
        </div>
      </div>

      {adjustments.length > 0 ? (
        <div className="moa-list">
          {adjustments.map((row) => {
            const isCharge = row.kind === 'charge';

            return (
              <div
                key={row.id}
                className={`moa-row${isCharge ? ' moa-row--charge' : ' moa-row--discount'}`}
              >
                <input
                  type="text"
                  className="moa-input"
                  value={row.label}
                  onChange={(e) => onChange(updateAdjustment(adjustments, row.id, { label: e.target.value }))}
                  placeholder={isCharge ? 'Charge label' : 'Discount label'}
                  aria-label={isCharge ? 'Charge label' : 'Discount label'}
                />

                <div className="moa-amount-wrap">
                  <span className="moa-amount-sign" aria-hidden>
                    {isCharge ? '+' : '−'}
                  </span>
                  <span className="moa-amount-prefix" aria-hidden>
                    ₹
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="moa-amount-input"
                    value={row.amount > 0 ? String(row.amount) : ''}
                    onChange={(e) =>
                      onChange(
                        updateAdjustment(adjustments, row.id, {
                          amount: parseManualAdjustmentAmount(e.target.value),
                        })
                      )
                    }
                    placeholder="0"
                    aria-label="Adjustment amount"
                  />
                </div>

                <button
                  type="button"
                  className="moa-remove"
                  onClick={() => onChange(adjustments.filter((item) => item.id !== row.id))}
                  aria-label="Remove adjustment"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
